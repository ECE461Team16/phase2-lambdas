import { lambdaHandler } from '../../app'; // import your lambdaHandler
import { expect, describe, it } from '@jest/globals';

describe('Unit test for lambdaHandler', function () {
    it('verifies successful response', async () => {
        const event = { 
            // httpMethod: 'POST', 
            body: JSON.stringify({ 
                URL: "https://github.com/cloudinary/cloudinary_npm"
            }) 
        }

        const result = await lambdaHandler(event);

        expect(result).toBeDefined();
        expect(result.statusCode).toEqual(200);
        expect(result.body).toEqual(expect.objectContaining({
            URL: expect.any(String),
            NET_SCORE: expect.any(Number),
            RAMP_UP_SCORE: expect.any(Number),
            CORRECTNESS_SCORE: expect.any(Number),
            BUS_FACTOR_SCORE: expect.any(Number),
            RESPONSIVE_MAINTAINER_SCORE: expect.any(Number),
            LICENSE_SCORE: expect.any(Number),
            DEPENDENCE_SCORE: expect.any(Number),
            REVIEWED_CODE_SCORE: expect.any(Number)
        }));
        // Add more assertions based on what lambdaHandler is supposed to return
    });
});