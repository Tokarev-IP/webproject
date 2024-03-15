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

import { AuthApi } from './auth-api'
import { AppApi } from './app-api'

export class SimpleAppStack extends cdk.Stack {
    private auth: apig.IResource;
    private userPoolId: string;
    private userPoolClientId: string;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        //Add a Movie table declaration
        const moviesTable = new dynamodb.Table(this, "MoviesTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "Movies",
        });

        //Add a MovieCast table declaration
        const movieCastsTable = new dynamodb.Table(this, "MovieCastsTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
            sortKey: { name: "actorName", type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "MovieCast",
        });
        movieCastsTable.addLocalSecondaryIndex({
            indexName: "roleIx",
            sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
        });

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
                        [moviesTable.tableName]: generateBatch(movies),
                        [movieCastsTable.tableName]: generateBatch(movieCasts),
                        [movieReviewsTable.tableName]: generateBatch(moviewReviews),
                    },
                },
                physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
            },
            policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [moviesTable.tableArn, movieCastsTable.tableArn, movieReviewsTable.tableArn],
            }),
        });

        const commonFnProps = {
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            runtime: lambda.Runtime.NODEJS_16_X,
        };

        //Get Movie by Id lambda function
        const getMovieByIdFn = new lambdanode.NodejsFunction(this, "GetMovieByIdFn",
            {
                ...commonFnProps,
                entry: `${__dirname}/lambdas/getMovieById.ts`,
                environment: {
                    TABLE_NAME: moviesTable.tableName,
                    TABLE_NAME_CAST: movieCastsTable.tableName,
                    REGION: "us-east-1",
                },
            }
        );

        //Get All Movies lambda function
        const getAllMoviesFn = new lambdanode.NodejsFunction(this, "GetAllMoviesFn",
            {
                ...commonFnProps,
                entry: `${__dirname}/lambdas/getAllMovies.ts`,
                environment: {
                    TABLE_NAME: moviesTable.tableName,
                    REGION: "us-east-1",
                },
            }
        );

        //Get MovieCast lambda function
        const getMovieCastMembersFn = new lambdanode.NodejsFunction(this, "GetCastMemberFn",
            {
                ...commonFnProps,
                entry: `${__dirname}/lambdas/getMovieCastMember.ts`,
                environment: {
                    TABLE_NAME: movieCastsTable.tableName,
                    REGION: "us-east-1",
                },
            }
        );

        //Post Movie lambda function
        const addMovieFn = new lambdanode.NodejsFunction(this, "Add Movie Fn", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/addMovie.ts`,
            environment: {
                TABLE_NAME: moviesTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Delete Movie by Id lambda function
        const deleteMovieByIdFn = new lambdanode.NodejsFunction(this, "Delete Movie by Id Fn", {
            ...commonFnProps,
            entry: `${__dirname}/lambdas/deleteMovieById.ts`,
            environment: {
                TABLE_NAME: moviesTable.tableName,
                REGION: "us-east-1",
            },
        });

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

        // ================================
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
        const protectedRes = appApi.root.addResource("protected");
        const publicRes = appApi.root.addResource("public");
        const protectedFn = new node.NodejsFunction(this, "ProtectedFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/auth/protected.ts`,
        });
        const publicFn = new node.NodejsFunction(this, "PublicFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/auth/public.ts`,
        });
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
        protectedRes.addMethod("GET", new apig.LambdaIntegration(protectedFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });
        publicRes.addMethod("GET", new apig.LambdaIntegration(publicFn));

/*        const userPool = new UserPool(this, "UserPool", {
            signInAliases: { username: true, email: true },
            selfSignUpEnabled: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        const userPoolId = userPool.userPoolId;
        const appClient = userPool.addClient("AppClient", {
            authFlows: { userPassword: true },
        });
        const userPoolClientId = appClient.userPoolClientId;
        new AuthApi(this, 'AuthServiceApi', {
            userPoolId: userPoolId,
            userPoolClientId: userPoolClientId,
        });
        new AppApi(this, 'AppApi', {
            userPoolId: userPoolId,
            userPoolClientId: userPoolClientId,
        });*/

        //permissions
        moviesTable.grantReadData(getMovieByIdFn);
        moviesTable.grantReadData(getAllMoviesFn);
        moviesTable.grantReadWriteData(addMovieFn);
        moviesTable.grantReadWriteData(deleteMovieByIdFn);
        movieCastsTable.grantReadData(getMovieCastMembersFn);
        movieCastsTable.grantReadData(getMovieByIdFn);
        movieReviewsTable.grantReadData(getAllMovieReviewsFn);
        movieReviewsTable.grantReadData(getMovieReviewByReviewerNameFn)
        movieReviewsTable.grantReadData(getAllReviewsByReviewerNameFn)
        movieReviewsTable.grantReadWriteData(addReviewFn)
        movieReviewsTable.grantReadWriteData(updateReviewContentFn)
        movieReviewsTable.grantReadData(getAllReviewsByYearFn)
        movieReviewsTable.grantReadWriteData(deleteReviewFn)

        // REST API 
        const api = new apig.RestApi(this, "RestAPI", {
            description: "demo api",
            deployOptions: {
                stageName: "dev",
            },
            defaultCorsPreflightOptions: {
                allowHeaders: ["Content-Type", "X-Amz-Date"],
                allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
                allowCredentials: true,
                allowOrigins: ["*"],
            },
        });

        //Endpoints
        const moviesEndpoint = api.root.addResource("movies");
        const reviewsEndpoint = api.root.addResource("reviews");
        const movieEndpoint = moviesEndpoint.addResource("{movieId}");
        const movieCastEndpoint = moviesEndpoint.addResource("cast");
        const deleteMovieEndpoint = movieEndpoint.addResource("delete");
        const movieReviewsEndpoint = movieEndpoint.addResource("reviews");
        const movieReviewByReviewerNameEndpoint = movieReviewsEndpoint.addResource("{reviewerName}");
        const reviewsReviewerEndpoint = reviewsEndpoint.addResource("{reviewerName}");
        const deleteReviewEndpoint = movieReviewByReviewerNameEndpoint.addResource("delete")

        //Methods
        //GET all movies
        moviesEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getAllMoviesFn, { proxy: true })
        );
        //GET movie by Id
        movieEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getMovieByIdFn, { proxy: true })
        );
        //POST movie
        moviesEndpoint.addMethod(
            "POST",
            new apig.LambdaIntegration(addMovieFn, { proxy: true })
        );
        //DELETE movie by Id
        deleteMovieEndpoint.addMethod(
            "DELETE",
            new apig.LambdaIntegration(deleteMovieByIdFn, { proxy: true })
        );
        //GET movie cast
        movieCastEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getMovieCastMembersFn, { proxy: true })
        );
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
            new apig.LambdaIntegration(addReviewFn, { proxy: true })
        );
        //PUT review content
        movieReviewByReviewerNameEndpoint.addMethod(
            "PUT",
            new apig.LambdaIntegration(updateReviewContentFn, { proxy: true })
        );
        //DELETE review
        deleteReviewEndpoint.addMethod(
            "DELETE",
            new apig.LambdaIntegration(deleteReviewFn, { proxy: true })
        );
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