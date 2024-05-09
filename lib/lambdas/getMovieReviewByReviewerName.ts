import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("Event: ", event);

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

        let commandInput: QueryCommandInput = {
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "movieId = :m and reviewerName = :rn",
            ExpressionAttributeValues: {
                ":m": movieId,
                ":rn": reviewerName,
            },
        };

        const commandOutput = await ddbDocClient.send(
            new QueryCommand(commandInput)
        );

        if (commandOutput.Items?.length == 0) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Empty result" }),
            };
        }

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