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

    async list(params: any): Promise<NotificationResponse> {
        const lastEvaluatedKey = params.lastEvaluatedCategory ? {
            category: params.lastEvaluatedCategory
        } : undefined

        const response = await this.documentClient
            .scan({
                TableName: this.props.table,
                IndexName: 'category-index',
                FilterExpression: 'contains(lowerCaseCategory, :prefix)',
                ExpressionAttributeValues: {
                    ':prefix': params.prefix.toLowerCase()
                },
                Limit: params.limit,
                ExclusiveStartKey: lastEvaluatedKey
            }).promise()
        if (response.Items === undefined) {
            return {} as NotificationResponse
        }
        return {
            messages: response.Items,
            lastEvaluatedKey: response.LastEvaluatedKey,
            itemCount: response.Count
        } as NotificationResponse
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

    async put(params: NotificationEntity): Promise<NotificationEntity> {
        const now = new Date()
        params.dateTime = now.toISOString()
        params.id = uuidv4()
        const getResponse = await this.documentClient
            .get({
                TableName: this.props.table,
                Key: {
                    id: params.id,
                },
            }).promise()
        if(!getResponse.Item){
            await this.documentClient
                .put({
                    TableName: this.props.table,
                    Item: params,
                }).promise()
        }
        return params
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
