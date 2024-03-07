import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {  
    try {
        console.log("Event: ", event);

        const queryParams = event.queryStringParameters;

        if (!queryParams || !queryParams.movieId) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing movie id parameters" }),
            };
        }

        const movieId = parseInt(queryParams.movieId);

        if (!movieId) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "Missing movie Id" }),
            };
        }

        const movieData = await ddbDocClient.send(
            new GetCommand({
                TableName: process.env.TABLE_NAME,
                Key: { id: movieId },
            })
        );

        let responseData: any = { movieData: movieData.Item };

        const isCastRequested = queryParams?.cast === "true";

        if (isCastRequested) {
            const castMembers = await ddbDocClient.send(
                new QueryCommand({
                    TableName: process.env.TABLE_NAME_CAST,
                    KeyConditionExpression: "movieId = :m",
                    ExpressionAttributeValues: {
                        ":m": movieId,
                    },
                })
            );

            return {
                statusCode: 200,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(castMembers.Items),
            };
        } 

        if (!movieData.Item) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "Invalid movie Id" }),
            };
        }

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(responseData),
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

/*async function getMovieById(movieId: number): Promise<any> {
    try {
        const commandOutput = await ddbDocClient.send(
            new GetCommand({
                TableName: process.env.TABLE_NAME,
                Key: { id: movieId },
            })
        );
        return commandOutput.Item;
    } catch (error) {
        console.error("Error fetching movie by ID:", error);
        throw error;
    }
}

async function getCastsByMovieId(movieId: number): Promise<any> {
    try {
        const commandOutput = await ddbDocClient.send(
            new QueryCommand({
                TableName: process.env.TABLE_NAME_CAST,
                KeyConditionExpression: "movieId = :m",
                ExpressionAttributeValues: {
                    ":m": movieId,
                },
            })
        );
        return commandOutput.Items;
    } catch (error) {
        console.error("Error fetching casts by movie ID:", error);
        throw error;
    }
}*/

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