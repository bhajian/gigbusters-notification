import {
    Context,
    APIGatewayProxyResult,
    APIGatewayProxyEvent
} from 'aws-lambda';
import {Env} from "../lib/env";
import {NotificationService} from "../service/notification-service";
import {getQueryString, getSub} from "../lib/utils";

const table = Env.get('TABLE')
const service = new NotificationService({
    table: table
})

export async function handler(event: APIGatewayProxyEvent, context: Context):
    Promise<APIGatewayProxyResult> {

    const result: APIGatewayProxyResult = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*'
        },
        body: ''
    }
    try{
        const userId = getSub(event)
        const limit = getQueryString(event, 'limit')
        const prefix = getQueryString(event, 'prefix')
        const lastEvaluatedCategory = getQueryString(event, 'lastEvaluatedCategory')
        const lastEvaluatedRanking = getQueryString(event, 'lastEvaluatedRanking')
        const item = await service.list({
            limit: limit,
            lastEvaluatedCategory: lastEvaluatedCategory,
            lastEvaluatedRanking: lastEvaluatedRanking,
            prefix: (prefix? prefix : '')
        })

        result.body = JSON.stringify(item)
        return result
    }
    catch (e) {
        result.statusCode = 500
        result.body = e.message
    }
    return result
}
