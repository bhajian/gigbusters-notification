import { DocumentClient, ScanInput } from 'aws-sdk/clients/dynamodb'
import {
    NotificationEntity,
    NotificationKeyParams, NotificationResponse
} from "./types"
import { v4 as uuidv4 } from 'uuid'

interface NotificationServiceProps{
    table: string
}

export class NotificationService {

    private props: NotificationServiceProps
    private documentClient = new DocumentClient()

    public constructor(props: NotificationServiceProps){
        this.props = props
    }

    async put(params: NotificationEntity): Promise<NotificationEntity> {
        const now = new Date()
        params.dateTime = now.toISOString()
        params.id = uuidv4()
        await this.documentClient
            .put({
                TableName: this.props.table,
                Item: params,
            }).promise()
        return params
    }

    async list(params: any): Promise<any> {
        const lastEvaluatedKey = params.lastEvaluatedCategory ? {
            category: params.lastEvaluatedCategory
        } : undefined

        const response = await this.documentClient
            .query({
                TableName: this.props.table,
                IndexName: 'userIndex',
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': params.userId,
                },
                ScanIndexForward: false,
                Limit: params.limit,
                ExclusiveStartKey: lastEvaluatedKey
            }).promise()
        if (response.Items === undefined) {
            return {} as NotificationResponse
        }
        return response
    }

    async get(params: NotificationKeyParams): Promise<NotificationEntity> {
        const response = await this.documentClient
            .get({
                TableName: this.props.table,
                Key: {
                    category: params.fromUserId,
                },
            }).promise()
        return response.Item as NotificationEntity
    }



    async delete(params: NotificationKeyParams) {
        const response = await this.documentClient
            .delete({
                TableName: this.props.table,
                Key: {
                    id: params.id,
                },
            }).promise()
    }

}
