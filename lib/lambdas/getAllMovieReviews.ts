import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("Event: ", event);

        const pathParameters = event.pathParameters;
        const queryParams = event.queryStringParameters;

        if (!pathParameters || !pathParameters.movieId) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing movie id parameters" }),
            };
        }

        const movieId = parseInt(pathParameters.movieId);

        let commandInput: QueryCommandInput = { TableName: process.env.TABLE_NAME, };
        if (queryParams && "minRating" in queryParams) {
            const minRating = queryParams.minRating ? parseInt(queryParams.minRating) : undefined;

            if (!minRating) {
                return {
                    statusCode: 400,
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({ message: "Incorrect Minimum Rating parameter" }),
                };
            }

            commandInput = {
                ...commandInput,
                KeyConditionExpression: "movieId = :m",
                FilterExpression: "rating > :r",
                ExpressionAttributeValues: {
                    ":m": movieId,
                    ":r": minRating,
                },
            };
        } else {
            commandInput = {
                ...commandInput,
                KeyConditionExpression: "movieId = :m",
                ExpressionAttributeValues: {
                    ":m": movieId,
                },
            };
        }

        const commandOutput = await ddbDocClient.send(
            new QueryCommand(commandInput)
        );

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(commandOutput.Items),
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