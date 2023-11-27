import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getZipData, getDataFromUrl } from './utils';
import { Package } from './models';

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

        let packageData: Package;

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
            };
        } else if (url) {
            console.log('using url');

            const name = url.split('/').pop();
            const binaryData = await getDataFromUrl(url);
            const [, , version] = getZipData(binaryData) || ['', '', ''];

            packageData = {
                name,
                version,
                repository: url,
                binaryData,
            };
        }

        // check if the package exists in the directory

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'hello world',
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
