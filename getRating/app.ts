import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TableName = 'registry';

//TODO: Update score, Update S3 bucket
export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log(event);
    const id = event.pathParameters?.id;
    console.log(id);

    if (!id) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.',
            }),
            headers: {
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        };
    }

    const getCommand = new GetCommand({
        TableName: TableName,
        Key: {
            id: id,
        },
    });

    console.log(getCommand);

    try {
        const result = await docClient.send(getCommand);
        console.log(result.Item);
        if (result.Item) {
            return {
                statusCode: 200,
                body: JSON.stringify(result.Item.ratings),
                headers: {
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                },
            };
        } else {
            console.log('Package does not exist');
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Package does not exist' }),
                headers: {
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
                },
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'The package rating system choked on at least one of the metrics.',
            }),
            headers: {
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
        };
    }
};
