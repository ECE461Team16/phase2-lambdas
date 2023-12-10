import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { escape } from 'lodash';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TableName = "registry"

//TODO: Update score, Update S3 bucket
export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log(event); 
    let user_input = event.pathParameters?.id;
    user_input = escape(user_input);
    const doc = new DOMParser().parseFromString(user_input, 'text/html');
    const sanitized_input = doc.documentElement.textContent || '';
    const id = sanitized_input;
    console.log(id);

    if (!id) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'There is missing field(s) in the PackageID/AuthenticationToken or it is formed improperly, or the AuthenticationToken is invalid.',
            }),
        };
    }

    const getCommand = new GetCommand({
        TableName: TableName,
        Key: {
            'id': id
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
            };
        } else {
            console.log('Package does not exist');
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Package does not exist' }),
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'The package rating system choked on at least one of the metrics.',
            }),
        };
    }
};
