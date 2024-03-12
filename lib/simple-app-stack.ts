import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "./shared/util";
import { movies, movieCasts, moviewReviews } from "./seed/movies";
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

        //Get Movie by Id lambda function
        const getMovieByIdFn = new lambdanode.NodejsFunction( this,"GetMovieByIdFn",
            {
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/lambdas/getMovieById.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
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
                architecture: lambda.Architecture.ARM_64,
                runtime: lambda.Runtime.NODEJS_16_X,
                entry: `${__dirname}/lambdas/getAllMovies.ts`,
                timeout: cdk.Duration.seconds(10),
                memorySize: 128,
                environment: {
                    TABLE_NAME: moviesTable.tableName,
                    REGION: "us-east-1",
                },
            }
        );

        //Get MovieCast lambda function
        const getMovieCastMembersFn = new lambdanode.NodejsFunction( this, "GetCastMemberFn",
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

        //Post Movie lambda function
        const addMovieFn = new lambdanode.NodejsFunction(this, "Add Movie Fn", {
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

        //Delete Movie by Id lambda function
        const deleteMovieByIdFn = new lambdanode.NodejsFunction(this, "Delete Movie by Id Fn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/deleteMovieById.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: moviesTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Get All Reviews of Movie lambda function
        const getAllMovieReviewsFn = new lambdanode.NodejsFunction(this, "Get All Reviews of Movie Fn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/getAllMovieReviews.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Get Movie Review by Reviewer Name lambda function
        const getMovieReviewByReviewerNameFn = new lambdanode.NodejsFunction(this, "Get Moview Review by Reviewer Name Fn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/getMovieReviewByReviewerName.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Get All Reviews by Reviewer Name lambda function
        const getAllReviewsByReviewerNameFn = new lambdanode.NodejsFunction(this, "Get All Reviews by Reviewer Name Fn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/getAllReviewsByReviewerName.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Post Review of a movie lambda function
        const addReviewFn = new lambdanode.NodejsFunction(this, "Post review of a movie", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/addReview.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Put the review text by reviewerName lambda function
        const updateReviewContentFn = new lambdanode.NodejsFunction(this, "Update text of review by reviewerName", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/putReviewContent.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Get All Reviews by Year lambda function
        const getAllReviewsByYearFn = new lambdanode.NodejsFunction(this, "Get All Reviews by Year Fn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/getAllReviewsByYear.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

        //Delete review by Id and Reviewer Name
        const deleteReviewFn = new lambdanode.NodejsFunction(this, "Delete review Fn", {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/lambdas/deleteReview.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                TABLE_NAME: movieReviewsTable.tableName,
                REGION: "us-east-1",
            },
        });

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
        const reviewByYearEndpoint = movieReviewsEndpoint.addResource("{year}");
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
        )
        //GET movie review by reviewer name
        movieReviewByReviewerNameEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getMovieReviewByReviewerNameFn, { proxy: true })
        )
        //GET all reviews by reviewer name
        reviewsReviewerEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getAllReviewsByReviewerNameFn, { proxy: true })
        )
        //POST review
        reviewsEndpoint.addMethod(
            "POST",
            new apig.LambdaIntegration(addReviewFn, { proxy: true })
        )
        //PUT review content
        movieReviewByReviewerNameEndpoint.addMethod(
            "PUT",
            new apig.LambdaIntegration(updateReviewContentFn, { proxy: true })
        )
        //GET all reviews by Year
        reviewByYearEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getAllReviewsByYearFn, { proxy: true })
        )
        //DELETE review
        deleteReviewEndpoint.addMethod(
            "DELETE",
            new apig.LambdaIntegration(deleteReviewFn, { proxy: true })
        );
    }
}