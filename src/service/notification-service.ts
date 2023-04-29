import { DocumentClient, ScanInput } from 'aws-sdk/clients/dynamodb'
import {
    NotificationEntity,
    NotificationKeyParams, NotificationResponse
} from "./types"
import { v4 as uuidv4 } from 'uuid'

interface NotificationServiceProps{
    notificationTable: string
    profileTable: string
    taskTable: string
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
                TableName: this.props.notificationTable,
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
                TableName: this.props.notificationTable,
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
        const transactions: NotificationEntity[] = response?.Items as NotificationEntity[]
        const transactionComplex = await this.mergeTransactions(transactions)
        return {
            Items: transactionComplex,
            Count: response?.Count,
            LastEvaluatedKey: response?.LastEvaluatedKey
        }
    }

    async get(params: NotificationKeyParams): Promise<NotificationEntity> {
        const response = await this.documentClient
            .get({
                TableName: this.props.notificationTable,
                Key: {
                    category: params.fromUserId,
                },
            }).promise()
        return response.Item as NotificationEntity
    }



    async delete(params: NotificationKeyParams) {
        const response = await this.documentClient
            .delete({
                TableName: this.props.notificationTable,
                Key: {
                    id: params.id,
                },
            }).promise()
    }

    async mergeTransactions(notification: any): Promise<any> {
        let userIds = []
        let taskIds: any[] = []
        let userIdMap = new Map<string, any>()
        let taskIdMap = new Map<string, any>()

        if (!notification || notification.length === 0) {
            return []
        }

        for (let i = 0; i < notification.length; i++) {
            const userId = notification[i].userId
            const subjectId = notification[i].subjectId
            const taskId = notification[i].objectId

            if(userId && !userIdMap.has(userId)){
                userIds.push({userId: userId})
                userIdMap.set(userId, undefined)
            }

            if(subjectId && !userIdMap.has(subjectId)){
                userIds.push({userId: subjectId})
                userIdMap.set(subjectId, undefined)
            }

            if(taskId && !taskIdMap.has(taskId)){
                taskIds.push({id: taskId})
                taskIdMap.set(taskId, undefined)
            }
        }

        const {profiles, tasks} = await this.batchGetProfiles(userIds, taskIds)
        const complexTransactionObjects : any[] = []

        for (let i = 0; i < notification.length; i++) {
            const userProfile = profiles.get(notification[i].userId)
            const subjectProfile = profiles.get(notification[i].subjectId)
            const task = tasks.get(notification[i].objectId)
            complexTransactionObjects.push({
                notification: notification[i],
                user: {
                    userId: userProfile?.userId,
                    name: userProfile?.name,
                    location: userProfile?.location,
                    accountCode: userProfile?.accountCode,
                    profilePhoto: (userProfile?.photos ?
                        userProfile.photos[0]: undefined),
                },
                subject: {
                    userId: subjectProfile?.userId,
                    name: subjectProfile?.name,
                    location: subjectProfile?.location,
                    accountCode: subjectProfile?.accountCode,
                    profilePhoto: (subjectProfile?.photos ?
                        subjectProfile.photos[0]: undefined),
                },
                task: task
            })
        }
        return complexTransactionObjects as any[]
    }

    async batchGetProfiles(userIds: any[], taskIds: any[]): Promise<any> {
        const requestItems: any = {}
        let profiles = new Map<string, any>()
        let tasks = new Map<string, any>()
        if (userIds?.length > 0) {
            requestItems[this.props.profileTable] = {
                Keys: userIds
            }
        }
        if (taskIds?.length > 0) {
            requestItems[this.props.taskTable] = {
                Keys: taskIds
            }
        }
        if(userIds?.length > 0 || taskIds?.length > 0){
            const userResponse = await this.documentClient
                .batchGet({
                    RequestItems: requestItems
                }).promise()
            let rawProfiles: any = []
            let rawTasks: any = []
            if(userResponse && userResponse.Responses && userResponse.Responses[this.props.profileTable]){
                rawProfiles = userResponse.Responses[this.props.profileTable]
                for(let i=0; i< rawProfiles.length; i++){
                    profiles.set(rawProfiles[i].userId, rawProfiles[i])
                }
            }
            if(userResponse && userResponse.Responses && userResponse.Responses[this.props.taskTable]){
                rawTasks = userResponse.Responses[this.props.taskTable]
                for(let i=0; i< rawTasks.length; i++){
                    tasks.set(rawTasks[i].id, rawTasks[i])
                }
            }
        }

        return {
            profiles: profiles,
            tasks: tasks,
        }
    }

}
