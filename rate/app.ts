import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import AWS from 'aws-sdk';
AWS.config.update({ region: 'us-east-1' });

/*
  * This is the handler for the /app endpoint. It invokes the phase1code lambda function
  * and returns the result.
  * example input event: {"URL": "https://github.com/cloudinary/cloudinary_npm"}
  * example output: "statusCode": 200, "body": {"URL": "https://github.com/cloudinary/cloudinary_npm", "NET_SCORE": 19.0504, "RAMP_UP_SCORE": 0.52, "CORRECTNESS_SCORE": 1, "BUS_FACTOR_SCORE": 0.0816, "RESPONSIVE_MAINTAINER_SCORE": 0.2, "LICENSE_SCORE": 1, "DEPENDENCE_SCORE": 0, "REVIEWED_CODE_SCORE": 124.3894}}
  * Call this function by:
   
    import AWS from 'aws-sdk';
    
    const lambda = new AWS.Lambda();
    const params = {
    FunctionName: 'RateFunction-RateFunction-tYak9soW0m0J',
    InvocationType: 'RequestResponse',
    // LogType: 'Tail',
    Payload: JSON.stringify(event, null, 2) 
    };
  
  *
*/
export const lambdaHandler = async (event:any): Promise<APIGatewayProxyResult> => {
  
  const lambda = new AWS.Lambda();
  const params = {
    FunctionName: 'phase1code',
    InvocationType: 'RequestResponse',
    // LogType: 'Tail',
    Payload: JSON.stringify(event, null, 2) 
  };
  const response = await lambda.invoke(params).promise();

  if (response.StatusCode !== 200) {
    // console.log('Error in lambda invoke', response);
    return {
      statusCode: 500,
      body: JSON.parse(response.Payload?.toString() || '{}')
    };
  }

  const parsedPayload = JSON.parse(response.Payload?.toString() || '{}');
  const responseBody = parsedPayload.body ? JSON.parse(parsedPayload.body) : {};
  console.log('responseBody', responseBody);

  return {
    statusCode: 200,
    body: responseBody
  };
}