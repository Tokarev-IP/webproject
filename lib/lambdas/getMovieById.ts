import { Handler } from "aws-lambda";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: Handler = async (event, context) => {
    try {
        console.log("Event: ", event);
        const parameters = event?.queryStringParameters;
        const movieId = parameters ? parseInt(parameters.movieId) : undefined;

        if (!movieId) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "Missing movie Id" }),
            };
        }

        //Get command operation
        const commandOutput = await ddbDocClient.send(
            new GetCommand({
                TableName: process.env.TABLE_NAME,
                Key: { id: movieId },
            })
        );

        console.log('GetCommand response: ', commandOutput) 

        if (!commandOutput.Item) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ Message: "Invalid movie Id" }),
            };
        }
        const body = {
            data: commandOutput.Item,  //Output data from Get command 
        };

        // Return Response
        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
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