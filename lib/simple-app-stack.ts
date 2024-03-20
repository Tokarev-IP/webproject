import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "./shared/util";
import { movies, movieCasts, moviewReviews } from "./seed/movies";
import { Construct } from 'constructs';
import * as apig from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from "aws-cdk-lib/aws-cognito";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";

export class SimpleAppStack extends cdk.Stack {
    private auth: apig.IResource;
    private userPoolId: string;
    private userPoolClientId: string;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        //Add a MoviewReview table declaration
        const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
            sortKey: { name: "reviewerName", type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "MovieReview",
        });
        movieReviewsTable.addGlobalSecondaryIndex({
            indexName: "reviewDateIx",
            partitionKey: { name: "reviewDate", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
        });
        movieReviewsTable.addGlobalSecondaryIndex({
            indexName: "reviewerNameIx",
            partitionKey: { name: "reviewerName", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
        });

        //Add an AWSCustomResource
        new custom.AwsCustomResource(this, "moviesddbInitData", {
            onCreate: {
                service: "DynamoDB",
                action: "batchWriteItem",
                parameters: {
                    RequestItems: {
                        [movieReviewsTable.tableName]: generateBatch(moviewReviews),
                    },
                },
                physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
            },
            policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [movieReviewsTable.tableArn],
            }),
        });

        const commonFnProps = {
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            runtime: lambda.Runtime.NODEJS_16_X,
        };

        //Get All Reviews of Movie lambda function
        const getAllMovieReviewsFn = new lambdanode.NodejsFunction(this, "Get All Reviews of Movie Fn", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/getAllMovieReviews.ts`,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Get Movie Review by Reviewer Name lambda function
        const getMovieReviewByReviewerNameFn = new lambdanode.NodejsFunction(this, "Get Moview Review by Reviewer Name Fn", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/getMovieReviewByReviewerName.ts`,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Get All Reviews by Reviewer Name lambda function
        const getAllReviewsByReviewerNameFn = new lambdanode.NodejsFunction(this, "Get All Reviews by Reviewer Name Fn", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/getAllReviewsByReviewerName.ts`,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Post Review of a movie lambda function
        const addReviewFn = new lambdanode.NodejsFunction(this, "Post review of a movie", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/addReview.ts`,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Put the review text by reviewerName lambda function
        const updateReviewContentFn = new lambdanode.NodejsFunction(this, "Update text of review by reviewerName", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/putReviewContent.ts`,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Get All Reviews by Year lambda function
        const getAllReviewsByYearFn = new lambdanode.NodejsFunction(this, "Get All Reviews by Year Fn", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/getAllReviewsByYear.ts`,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Delete review by Id and Reviewer Name lambda function
        const deleteReviewFn = new lambdanode.NodejsFunction(this, "Delete review Fn", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/deleteReview.ts`,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Register
        const userPool = new UserPool(this, "UserPool", {
            signInAliases: { username: true, email: true },
            selfSignUpEnabled: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        this.userPoolId = userPool.userPoolId;
        const appClient = userPool.addClient("AppClient", {
            authFlows: { userPassword: true },
        });
        this.userPoolClientId = appClient.userPoolClientId;

        //Auth Api
        const authApi = new apig.RestApi(this, "AuthServiceApi", {
            description: "Authentication Service RestApi",
            endpointTypes: [apig.EndpointType.REGIONAL],
            defaultCorsPreflightOptions: {
                allowOrigins: apig.Cors.ALL_ORIGINS,
            },
        });
        this.auth = authApi.root.addResource("auth");

        this.addAuthRoute(
            "signup",
            "POST",
            "SignupFn",
            'signup.ts'
        );
        this.addAuthRoute(
            "confirm_signup",
            "POST",
            "ConfirmFn",
            "confirm-signup.ts"
        );
        this.addAuthRoute('signout', 'GET', 'SignoutFn', 'signout.ts');
        this.addAuthRoute('signin', 'POST', 'SigninFn', 'signin.ts');

        //App Api
        const appApi = new apig.RestApi(this, "AppApi", {
            description: "App RestApi",
            endpointTypes: [apig.EndpointType.REGIONAL],
            defaultCorsPreflightOptions: {
                allowOrigins: apig.Cors.ALL_ORIGINS,
            },
        });
        const appCommonFnProps = {
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: "handler",
            environment: {
                USER_POOL_ID: this.userPoolId,
                CLIENT_ID: this.userPoolClientId,
                REGION: cdk.Aws.REGION,
            },
        };

        const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/auth/authorizer.ts`,
        });
        const requestAuthorizer = new apig.RequestAuthorizer(
            this,
            "RequestAuthorizer",
            {
                identitySources: [apig.IdentitySource.header("cookie")],
                handler: authorizerFn,
                resultsCacheTtl: cdk.Duration.minutes(0),
            }
        );

        //permissions
        movieReviewsTable.grantReadData(getAllMovieReviewsFn);
        movieReviewsTable.grantReadData(getMovieReviewByReviewerNameFn)
        movieReviewsTable.grantReadData(getAllReviewsByReviewerNameFn)
        movieReviewsTable.grantReadWriteData(addReviewFn)
        movieReviewsTable.grantReadWriteData(updateReviewContentFn)
        movieReviewsTable.grantReadData(getAllReviewsByYearFn)
        movieReviewsTable.grantReadWriteData(deleteReviewFn)

        //Endpoints
        const moviesEndpoint = appApi.root.addResource("movies");
        const reviewsEndpoint = appApi.root.addResource("reviews");
        const movieEndpoint = moviesEndpoint.addResource("{movieId}");
        const movieReviewsEndpoint = movieEndpoint.addResource("reviews");
        const movieReviewByReviewerNameEndpoint = movieReviewsEndpoint.addResource("{reviewerName}");
        const reviewsReviewerEndpoint = reviewsEndpoint.addResource("{reviewerName}");
        const deleteReviewEndpoint = movieReviewByReviewerNameEndpoint.addResource("delete")

        //GET moview reviews
        movieReviewsEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getAllMovieReviewsFn, { proxy: true })
        );
        //GET movie review by reviewer name
        movieReviewByReviewerNameEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getMovieReviewByReviewerNameFn, { proxy: true })
        );
        //GET all reviews by reviewer name
        reviewsReviewerEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getAllReviewsByReviewerNameFn, { proxy: true })
        );
        //POST review
        reviewsEndpoint.addMethod(
            "POST",
            new apig.LambdaIntegration(addReviewFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });
        //PUT review content
        movieReviewByReviewerNameEndpoint.addMethod(
            "PUT",
            new apig.LambdaIntegration(updateReviewContentFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });
        //DELETE review
        deleteReviewEndpoint.addMethod(
            "DELETE",
            new apig.LambdaIntegration(deleteReviewFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });
    }

    private addAuthRoute(
        resourceName: string,
        method: string,
        fnName: string,
        fnEntry: string,
        allowCognitoAccess?: boolean
    ): void {
        const commonFnProps = {
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "handler",
            environment: {
                USER_POOL_ID: this.userPoolId,
                CLIENT_ID: this.userPoolClientId,
                REGION: cdk.Aws.REGION
            },
        };

        const resource = this.auth.addResource(resourceName);

        const fn = new node.NodejsFunction(this, fnName, {
            ...commonFnProps,
            entry: `${__dirname}/auth/${fnEntry}`,
        });

        resource.addMethod(method, new apig.LambdaIntegration(fn));
    } 

}