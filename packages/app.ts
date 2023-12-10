import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

/*

Example Requests

[
  {
    "Version": "Exact (1.2.3)",
    "Name": "smallest"
  }
  {
    "Version": "Bounded range (1.2.3-2.1.0)",
    "Name": "cloudinary"
  }
  {
    "Version": "Carat (^1.2.3)",
    "Name": "aws-sdk"
  }
  {
    "Version": Tilde (~1.2.3)",
    "Name": "aws-lambda"
  }
]

Tilde
Given ~1.2.3:
Anything from 1.2.3 to <1.3.0

Carat
Given ^1.2.3:
Anything from 1.2.3 to <2.0.0

*/

const TYPES = {
  EXACT: 0,
  TILDE: 1,
  CARAT: 2,
  BOUNDED: 3,
}

const DBclient = new DynamoDBClient()
const DBdocclient = DynamoDBDocumentClient.from(DBclient)
const TABLENAME = "package-registry"

function convertVersionToInt(version: string): number {
    const versionArray = version.split('.')
    return parseInt(versionArray.join(''))
}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    console.log("===== Performing packages post =====\n")

    const body = event.body
    if (body == undefined) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'some error happened',
        }),
      }
    }

    var type = TYPES.EXACT

    if (body.includes("-")) {
        type = TYPES.BOUNDED
    } else if (body.includes("^")) {
        type = TYPES.CARAT
    } else if (body.includes("~")) {
        type = TYPES.TILDE
    }
    
    // MUST LOOP TO GET ALL INSTANCES
    
    const scanCommand = new ScanCommand({
      TableName: TABLENAME,
      ProjectionExpression: "id, version",
    })
    
    var Scanned = await DBdocclient.send(scanCommand)
    console.log("Scanned: ", Scanned)
    
    var results = Scanned.Items
    console.log("Results: ", results)

    if (results == undefined) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'some error happened',
        }),
      }
    }
    
    // for (var i = 0; i < results.length; i++) {
    //     var version = results[i]["Version"]
    //     var matches = version.match(/\((\d+\.\d+\.\d+)\)/)
    //     while ((matches = )
    // }





    try {
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
