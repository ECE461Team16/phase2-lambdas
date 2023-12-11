import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getZipData, getZipFromUrl, isJSON } from './utils';
import { Package } from './models';
import AWS from 'aws-sdk';

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
        //input sanitization
        let sanitized_content = event.Content;
        let sanitized_url = event.URL;

        const urlRegex = /(github\.com|npmjs\.com)\/.+/;
        const MAX_URL_LENGTH = 2048;

        sanitized_url = sanitized_url?.trim();

        if (sanitized_url && sanitized_url.length > MAX_URL_LENGTH) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid request: URL is too long',
                }),
            };
        }
        if (sanitized_url && !urlRegex.test(sanitized_url)) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid request: URL is invalid',
                }),
            };
        }

        const content = sanitized_content;
        const url = sanitized_url;
        
        // End of input sanitization

        if (!content && !url) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid request: Content or URL is required',
                }),
            };
        }

        let packageData: Package = {
            name: '',
            version: '',
            repository: '',
            binaryData: Buffer.from(''),
            ratings: '',
        };

        if (content) {
            console.log('using content string');

            const binaryData: Buffer = Buffer.from(content, 'base64');
            const [name, repository, version] = getZipData(binaryData) || ['', '', ''];

            packageData = {
                name,
                version,
                repository,
                binaryData,
                ratings: '',
            };
        } else if (url) {
            console.log('using url');
            let owner;
            let name;
            if (url.endsWith('/')) {
                owner = url.slice(0, -1).split('/')[3];
                name = url.slice(0, -1).split('/').pop();
            } else {
                owner = url.split('/')[3];
                name = url.split('/').pop();
            }
            console.log('url', url);
            const binaryData = await getZipFromUrl(owner, name);
            const [, , version] = getZipData(binaryData) || ['', '', ''];

            packageData = {
                name,
                version,
                repository: url,
                binaryData,
                ratings: '',
            };
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid request: Malformed request',
                }),
            };
        }
        console.log('packageData', packageData);

        if (packageData.name === '' || packageData.version === '' || packageData.repository === '') {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid request: Package does not contain necessary information',
                }),
            };
        }

        const dynamoDb = new AWS.DynamoDB.DocumentClient();
        const params_dynamo_query = {
            TableName: 'registry',
            Key: {
                id: packageData.name.toLowerCase(),
            },
        };
        const data = await dynamoDb.get(params_dynamo_query).promise();
        if (data.Item !== undefined && data.Item !== null) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    message: 'Package already exists',
                }),
            };
        }

        const lambda = new AWS.Lambda();
        const lambda_params = {
            FunctionName: 'RateFunction-RateFunction-tYak9soW0m0J',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify({ URL: packageData.repository }, null, 2),
        };
        const score = await lambda
            .invoke(lambda_params, function (err: Error, data: any) {
                console.log(err, data);
            })
            .promise();
        console.log('scores', JSON.parse(score.Payload as string).body.NET_SCORE);
        packageData.ratings = JSON.parse(score.Payload as string).body;

        // TODO: disquality for rating

        const s3 = new AWS.S3();
        const params = {
            Bucket: 'ingested-package-storage',
            Key: `${packageData.name.toLowerCase()}.zip`,
            Body: packageData.binaryData,
        };
        await s3
            .upload(params, (err: Error, data: any) => {
                console.log(err, data);
            })
            .promise();

        const dynamoClient = new AWS.DynamoDB();
        const input = {
            Item: {
                id: {
                    S: packageData.name.toLowerCase(),
                },
                version: {
                    S: packageData.version,
                },
                name: {
                    S: packageData.name,
                },
                ratings: {
                    S: JSON.stringify(packageData.ratings),
                },
            },
            TableName: 'registry',
        };
        await dynamoClient
            .putItem(input, (err: Error, data: any) => {
                console.log(err, data);
            })
            .promise();

        return {
            statusCode: 201,
            body: JSON.stringify({
                meteadata: {
                    Name: packageData.name,
                    Version: packageData.version,
                    ID: packageData.name.toLowerCase(),
                },
                data: {
                    Content: packageData.binaryData.toString('base64'),
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
