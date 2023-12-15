import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TableName = 'registry';

interface ResponseBody {
    NetScore: number;
    RampUp: number;
    Correctness: number;
    BusFactor: number;
    ResponsiveMaintainer: number;
    LicenseScore: number;
    GoodPinningPractice: number;
    PullRequest: number;
}

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
        const keyMapping: Record<string, keyof ResponseBody> = {
            NET_SCORE: 'NetScore',
            RAMP_UP_SCORE: 'RampUp',
            CORRECTNESS_SCORE: 'Correctness',
            BUS_FACTOR_SCORE: 'BusFactor',
            RESPONSIVE_MAINTAINER_SCORE: 'ResponsiveMaintainer',
            LICENSE_SCORE: 'LicenseScore',
            DEPENDENCE_SCORE: 'GoodPinningPractice',
            REVIEWED_CODE_SCORE: 'PullRequest',
        };

        if (result.Item) {
            const newData: ResponseBody = Object.fromEntries(
                Object.entries(JSON.parse(result.Item.ratings)).map(([key, value]) => [keyMapping[key], value])
              );

            console.log(newData);
            return {
                statusCode: 200,
                body: JSON.stringify(newData),
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
