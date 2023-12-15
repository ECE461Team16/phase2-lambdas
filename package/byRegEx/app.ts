import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB, DynamoDBClient, ScanCommand, ScanCommandInput } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

const DBclient = new DynamoDBClient()
const DBdocclient = DynamoDBDocumentClient.from(DBclient)
const TABLENAME = "registry"

async function getReadMes(items: any) {
  var readmes: any[] = []

  items.forEach((item: any) => {
    console.log(item)
    readmes.push(item.readme)
  })

  return readmes
}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log("===== Performing Regex =====\n", event)

    if (event.RegEx == null) {
      console.log("RETURNING 404\n")
      return {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
        },
        statusCode: 500,
        body: 'No package found under this regex.',
      }
    }

    // ignore error for now
    const regex = event.RegEx

    console.log(regex);

    // create command and inputs
    const params = {
      TableName: TABLENAME,
      ProjectionExpression: "id, version, readme", 
    }

    try {
        // scan may exceed 1MB, so we need to use pagination
        const scanCommand = new ScanCommand(params);
        const results = await DBdocclient.send(scanCommand);

        if (results.Count == undefined || results.Count == 0) {
          console.log("RETURNING 404\n")
          return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 404,
            body: 'No package found under this regex.',
          }
        }

        // use regex to filter out packages
        const packages = results.Items
        console.log("Packages: ", packages)

        const regexp = new RegExp(regex)
        let return_packages: any[] = []

        // iterate through packages and check if readme matches regex
        packages.forEach((pkg: any) => {
          var readMe = pkg.readme
          console.log("ReadMe: ", readMe)
          console.log("Test: ", regexp.test(readMe.S))
          if (regexp.exec(readMe.S)) {
            return_packages.push(pkg)
          }
        })

        console.log("Matches 1:\n", return_packages)

        packages.forEach((pkg: any) => {
          var readMe = pkg.readme
          console.log("ReadMe: ", readMe)
          console.log("Test: ", readMe.S.match(regexp))
          if (readMe.S.match(regexp)) {
            return_packages.push(pkg)
          }
        })
        
        console.log("Matches 2:\n", return_packages)

        // format all matches for response
        const outputArray = return_packages.map(item => {
          return {
            "Version": item.version.S,
            "Name": item.id.S
          };
        });

        console.log("Output: \n", outputArray)

        if (outputArray.length == 0) {
          console.log("RETURNING 404\n")
          return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 500,
            body: 'No package found under this regex.',
          }
        }

        console.log("RETURNING 200\n")
        return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 200,
            body: JSON.stringify(outputArray),
        };
    } catch (err) {
        console.log("RETURNING 500\n")
        console.log(err);
        return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 500,
            body: 'Error occured while scanning.'
        };
    }
};
