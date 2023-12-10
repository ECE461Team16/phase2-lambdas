import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import AWS from 'aws-sdk';
import { escape } from 'lodash';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        //sanitize input
        let user_input = event.pathParameters?.id;
        user_input = escape(user_input);
        const doc = new DOMParser().parseFromString(user_input, 'text/html');
        const sanitized_input = doc.documentElement.textContent || '';
        const id = sanitized_input;

        if (!id) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid request: ID is required',
                }),
            };
        }

        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params_dynamo_query = {
            TableName: 'registry',
            Key: {
                id,
            },
        };

        const data = await dynamoDb.get(params_dynamo_query).promise();
        if (data.Item === undefined || data.Item === null) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Package does not exist',
                }),
            };
        }

        const name = data.Item?.name;
        const version = data.Item?.version;
        if (name === undefined || version === undefined) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    message: 'error: invalid package entry found',
                }),
            };
        }

        const s3 = new AWS.S3();
        const params = {
            Bucket: 'ingested-package-storage',
            Key: id + '.zip',
        };
        const package_zip = await s3
            .getObject(params, (err: Error, data: any) => {
                console.log(err, data);
            })
            .promise();

        return {
            statusCode: 200,
            body: JSON.stringify({
                meteadata: {
                    Name: name,
                    Version: version,
                    ID: id,
                },
                data: {
                    Content: package_zip.Body.toString('base64'),
                },
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'error',
            }),
        };
    }
};
