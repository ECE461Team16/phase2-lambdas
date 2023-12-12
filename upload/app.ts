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
        console.log('event', event);

        let content;
        let url;
        if (event.body) {
            content = JSON.parse(event.body).Content;
            url = JSON.parse(event.body).URL;
        }

        console.log('content', content);
        console.log('url', url);

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
            readme: '',
            binaryData: Buffer.from(''),
            ratings: '',
        };

        if (content) {
            console.log('using content string');

            const binaryData: Buffer = Buffer.from(content, 'base64');
            const [name, repository, version, readme] = getZipData(binaryData) || ['', '', '', ''];

            packageData = {
                name,
                version,
                repository,
                readme,
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
            const [, , version, readme] = getZipData(binaryData) || ['', '', '', ''];

            packageData = {
                name,
                version,
                readme,
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
        const score_withURL = JSON.parse(score.Payload as string).body;
        const { URL, ...scores } = score_withURL;
        packageData.ratings = scores;

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
                readme: {
                    S: packageData.readme,
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
            headers: {
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': '*',
            },
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
