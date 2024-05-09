import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from 'ajv';
import schema from '../shared/types.schema.json';

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["PutReviewContent"] || {});

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("Event: ", event);
        const body = event.body ? JSON.parse(event.body) : undefined;
        if (!body) {
            return {
                statusCode: 500,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing request body" }),
            };
        }
        if (!isValidBodyParams(body)) {
            return {
                statusCode: 500,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    message: `Incorrect type. Must match content schema`,
                    schema: schema.definitions["PutReviewContent"],
                }),
            };
        }

        const pathParameters = event.pathParameters;

        if (!pathParameters || !pathParameters.movieId || !pathParameters.reviewerName) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing any parameters" }),
            };
        }

        const movieId = parseInt(pathParameters.movieId);
        const reviewerNameString = pathParameters.reviewerName;
        const reviewerName = reviewerNameString.replace(/([A-Z])/g, ' $1').trim();

        let commandInput = {
            TableName: process.env.TABLE_NAME,
            Key: {
                "movieId": movieId,
                "reviewerName": reviewerName,
            },
            UpdateExpression: "SET content = :c",
            ExpressionAttributeValues: {
                ":c": body.content
            },
        };

        const commandOutput = await ddbDocClient.send(
            new UpdateCommand(commandInput)
        );

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(commandOutput),
        };

    } catch (error) {
        console.log(JSON.stringify(error));
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ error }),
        };
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}