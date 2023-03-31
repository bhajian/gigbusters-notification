import { DocumentClient, ScanInput } from 'aws-sdk/clients/dynamodb'
import {
    MessageEntity,
    MessageKeyParams, MessageResponse
} from "./types"
import { v4 as uuidv4 } from 'uuid'

interface MessageServiceProps{
    table: string
}

export class MessageService {

    private props: MessageServiceProps
    private documentClient = new DocumentClient()

    public constructor(props: MessageServiceProps){
        this.props = props
    }

    async list(params: any): Promise<MessageResponse> {
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
            return {} as MessageResponse
        }
        return {
            messages: response.Items,
            lastEvaluatedKey: response.LastEvaluatedKey,
            itemCount: response.Count
        } as MessageResponse
    }

    async get(params: MessageKeyParams): Promise<MessageEntity> {
        const response = await this.documentClient
            .get({
                TableName: this.props.table,
                Key: {
                    category: params.fromUserId,
                },
            }).promise()
        return response.Item as MessageEntity
    }

    async put(params: MessageEntity): Promise<MessageEntity> {
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

    async delete(params: MessageKeyParams) {
        const response = await this.documentClient
            .delete({
                TableName: this.props.table,
                Key: {
                    id: params.id,
                },
            }).promise()
    }

}
