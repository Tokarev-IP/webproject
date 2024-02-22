import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "./shared/util";
import { movies, movieCasts } from "./seed/movies";
import { Construct } from 'constructs';
import * as apig from 'aws-cdk-lib/aws-apigateway';

export class SimpleAppStack extends cdk.Stack {
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
        const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
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

        //Simple function
        const simpleFn = new lambdanode.NodejsFunction(this, "SimpleFn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/simple.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
        });
        const simpleFnURL = simpleFn.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.AWS_IAM,
            cors: {
                allowedOrigins: ["*"],
            },
        });
        new cdk.CfnOutput(this, "Simple Function Url", { value: simpleFnURL.url });

        //Add an AWSCustomResource
        new custom.AwsCustomResource(this, "moviesddbInitData", {
            onCreate: {
                service: "DynamoDB",
                action: "batchWriteItem",
                parameters: {
                    RequestItems: {
                        [moviesTable.tableName]: generateBatch(movies),
                        [movieCastsTable.tableName]: generateBatch(movieCasts),
                    },
                },
                physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
            },
            policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [moviesTable.tableArn, movieCastsTable.tableArn],
            }),
        });

        //Get Movie by Id lambda function
        const getMovieByIdFn = new lambdanode.NodejsFunction(
            this,
            "GetMovieByIdFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/lambdas/getMovieById.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: moviesTable.tableName,
                    REGION: 'us-east-1',
                },
            }
        );
        const getMovieByIdURL = getMovieByIdFn.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowedOrigins: ["*"],
            },
        });
        new cdk.CfnOutput(this, "Get Movie Function Url", { value: getMovieByIdURL.url });

        //Get All Movies lambda function
        const getAllMoviesFn = new lambdanode.NodejsFunction(
            this,
            "getAllMoviesFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/lambdas/getAllMovies.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: moviesTable.tableName,
                    REGION: 'us-east-1',
                },
            }
        );
        const getAllMoviesURL = getAllMoviesFn.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowedOrigins: ["*"],
            },
        });
        new cdk.CfnOutput(this, "Get All Movies Function Url", { value: getAllMoviesURL.url });

        //Get MovieCast lambda function
        const getMovieCastMembersFn = new lambdanode.NodejsFunction(
            this,
            "GetCastMemberFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/lambdas/getMovieCastMember.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: movieCastsTable.tableName,
                    REGION: "us-east-1",
                },
            }
        );

        //Post a movie
        const newMovieFn = new lambdanode.NodejsFunction(this, "AddMovieFn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/addMovie.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: moviesTable.tableName,
                REGION: "us-east-1",
            },
        });

        //permissions
        moviesTable.grantReadData(getMovieByIdFn)
        moviesTable.grantReadData(getAllMoviesFn)
        moviesTable.grantReadWriteData(newMovieFn)
        movieCastsTable.grantReadData(getMovieCastMembersFn);

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
        const movieEndpoint = moviesEndpoint.addResource("{movieId}");
        const movieCastEndpoint = moviesEndpoint.addResource("cast");

        //Methods
        //GET movies
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
            new apig.LambdaIntegration(newMovieFn, { proxy: true })
        );
        //Get movie cast
        movieCastEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getMovieCastMembersFn, { proxy: true })
        );

    }
}