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
const TABLENAME = "registry"

function convertVersionToInt(version: string): number {
    console.log("Converting version: ", version)
    version = version.replace(/^[\^~\-]+/, "");
    const versionArray = version.split('.')
    return parseInt(versionArray.join(''))
}

// Digit is 1, when version is 1.2.3, it will return 1.3.0 (Tilde)
// Digit is 2, when version is 1.2.3, it will return 2.0.0 (Carat)
function roundtoNearestVersion(version: number, digit: number) {
    var place = 10 ** digit
    return Math.ceil(version / place) * place
}

export const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log("===== Performing packages post =====\n")

    const body = event.body
    if (body == undefined) {
      return {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
        },
        statusCode: 200,
        body: 'No packages received.',
      }
    }
    
    // initialize and get variables from body
    var version = body.Version
    var name = body.Name
    console.log("Version: ", version, " Name: ", name)
    console.log("Version type: ", typeof version, " Name type: ", typeof name)

    var type = TYPES.EXACT
    var requestVersion = 0
    var boundedVersion = 0
    var match = null
    
    // validate body of input
    if (version.includes("-")) {
      type = TYPES.BOUNDED
      const regex = /\((\d+\.\d+\.\d+)-(\d+\.\d+\.\d+)\)/
      match = regex.exec(version)
      if (match) {
        requestVersion = convertVersionToInt(match[1])
        boundedVersion = convertVersionToInt(match[2])
        console.log("Found bounded")
      }
    } else if (version.includes("^")) {
      type = TYPES.CARAT
      const regex = /\((\^\d+\.\d+\.\d+)\)/
      match = regex.exec(version)
      if (match) {
        requestVersion = convertVersionToInt(match[1])
        console.log("Found carat")
      }
    } else if (version.includes("~")) {
      type = TYPES.TILDE
      const regex = /\((\~\d+\.\d+\.\d+)\)/
      match = regex.exec(version)
      if (match) {
        requestVersion = convertVersionToInt(match[1])
        console.log("Found tilde")
      }
    } else {      
      var regex = /\((\d+\.\d+\.\d+)\)/
      match = regex.exec(version)
      if (match) {
        requestVersion = convertVersionToInt(match[1])
        console.log("Found exact")
      }
    }
    
    console.log("Request version: ", requestVersion)
    console.log("Bounded version: ", boundedVersion)
    console.log("Type: ", type)

    if (!match) {
      return {
        headers: {
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
        },
        statusCode: 200,
        body: 'No packages matched.'
      }
    }

    console.log("Match: ", match)

    // create scan command
    const scanCommand = new ScanCommand({
      TableName: TABLENAME,
      ProjectionExpression: "id, version",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": name,
      }
    })
    
    try {
        // search for packages with the same name
        var result = await DBdocclient.send(scanCommand)
        console.log("Scanned: ", result)

        var items = result.Items
        console.log("Items: ", items)

        if (result.Count == 0) {
          return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 500,
            body:  'No packages found.',
          }
        }
      
        var return_packages = []
      
        // go through each and determine is it meets criteria
        items.forEach(pkg => {
          console.log("Package: ", pkg)
          var pkgVer = convertVersionToInt(pkg.version)
          switch(type) {
            case TYPES.BOUNDED:
              if (pkgVer >= requestVersion && pkgVer < boundedVersion) {
                return_packages.push(pkg)
              }
              break;
            case TYPES.CARAT:
              if (pkgVer >= requestVersion && pkgVer < roundtoNearestVersion(requestVersion, 2)) {
                return_packages.push(pkg)
              }
              break;
            case TYPES.TILDE:
              if (pkgVer >= requestVersion && pkgVer < roundtoNearestVersion(requestVersion, 1)) {
                return_packages.push(pkg)
              }  
              break;
            default: // EXACT
              if (pkgVer == requestVersion) {
                return_packages.push(pkg)
              }
          }
        })
      
        console.log("Return packages: ", return_packages)
      
        if (return_packages.length == 0) {
          return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 200,
            body: JSON.stringify({
              message: 'No packages matched',
            }),
          }
        }

        return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 200,
            body: JSON.stringify(return_packages),
        };
    } catch (err) {
        console.log(err);
        return {
            headers: {
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
            },
            statusCode: 500,
            body: 'Error occured while searching for packages.',
        };
    }
};
