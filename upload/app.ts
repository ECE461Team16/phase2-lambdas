import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getZipData, getZipFromUrl } from './utils';
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
        const content = event.Content;
        const url = event.URL;

        console.log('content', content);
        console.log('URL', url);

        if (!content && !url) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Content or URL is required',
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

            if (name === '' && repository === '' && version === '') {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        message: 'Malformed zip file',
                    }),
                };
            }

            packageData = {
                name,
                version,
                repository,
                binaryData,
                ratings: '',
            };

            console.log('packageData', packageData);
        } else if (url) {
            console.log('using url');

            const name = url.split('/').pop();
            const binaryData = await getZipFromUrl(url);
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
                    message: 'Malformed request',
                }),
            };
        }

        const lambda = new AWS.Lambda();
        const lambda_params = {
            FunctionName: 'RateFunction-RateFunction-tYak9soW0m0J',
            InvocationType: 'RequestResponse',
            // LogType: 'Tail',
            Payload: JSON.stringify({ URL: packageData.repository }, null, 2),
        };
        const score = await lambda
            .invoke(lambda_params, function (err: Error, data: any) {
                console.log(err, data);
            })
            .promise();
        console.log('scores', JSON.parse(score.Payload as string).body.NET_SCORE);
        packageData.ratings = JSON.parse(score.Payload as string).body;

        const s3 = new AWS.S3();
        const params = {
            Bucket: 'ingested-package-storage',
            Key: `${packageData.name}.zip`,
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
            statusCode: 200,
            body: JSON.stringify({
                input,
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
    }
};
