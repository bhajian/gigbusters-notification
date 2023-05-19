import { DocumentClient, ScanInput } from 'aws-sdk/clients/dynamodb'
import {
    NotificationEntity,
    NotificationKeyParams, NotificationResponse
} from "./types"
import { v4 as uuidv4 } from 'uuid'
import Expo from 'expo-server-sdk'

interface NotificationServiceProps{
    taskTable: string
    transactionTable?: string
    profileTable: string
    notificationTable: string
    expoAccessToken: string
}

export class NotificationService {

    private props: NotificationServiceProps
    private documentClient = new DocumentClient()
    private expo : Expo

    public constructor(props: NotificationServiceProps){
        this.props = props
        this.expo = new Expo({ accessToken: props.expoAccessToken })
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

    async createTransactionNotification(params: any): Promise<any> {
        const now = new Date()
        let task = undefined
        if(params?.newImage?.taskId){
            task = await this.getTask({id: params?.newImage?.taskId})
        }
        if(params?.eventName === 'INSERT' && params?.newImage?.status === 'applied'
            && params?.newImage?.type === 'application'){
            let notificationType = 'Consumer/Notifications'
            await this.sendNotification({
                dateTime: now.toISOString(),
                userId: params?.newImage?.customerId,
                notificationType: 'NEW_APPLICATION',
                subjectId: params?.newImage?.workerId,
                objectId: params?.newImage?.taskId,
                transactionId: params?.newImage?.id,
                notificationTitle: `New application for ${task.category}.`,
                notificationBody: `You have received a response for the ${task.category} task you posted.`,
                notificationData: {
                    transactionId: params?.newImage?.id,
                    notificationType: notificationType
                }
            })
        }
        if(params?.eventName === 'INSERT' && params?.newImage?.status === 'initiated'
            && params?.newImage?.type === 'referral'){
            let notificationType = 'Consumer/Notifications'
            await this.sendNotification({
                dateTime: now.toISOString(),
                userId: params?.newImage?.customerId,
                notificationType: 'NEW_REFERRAL',
                subjectId: params?.newImage?.referrerId,
                objectId: params?.newImage?.taskId,
                transactionId: params?.newImage?.id,
                notificationTitle: `New Referral for ${task.category}.`,
                notificationBody: `You have received a new referral for ${task.category}`,
                notificationData: {
                    transactionId: params?.newImage?.id,
                    notificationType: notificationType
                }
            })
        }
        if(params?.eventName === 'MODIFY' && params?.newImage?.type === 'application'
            && params?.newImage?.status === 'applicationAccepted'
            && params?.oldImage?.status === 'applied'){
            let notificationType = 'Worker/Notifications'
            await this.sendNotification({
                dateTime: now.toISOString(),
                userId: params?.newImage?.workerId,
                notificationType: 'APPLICATION_ACCEPTED',
                subjectId: params?.newImage?.customerId,
                objectId: params?.newImage?.taskId,
                transactionId: params?.newImage?.id,
                notificationTitle: 'It is a match.',
                notificationBody: `The customer accepted your response to the ${task.category} task.` +
                    'You can now chat with the customer.',
                notificationData: {
                    transactionId: params?.newImage?.id,
                    notificationType: notificationType
                }
            })
        }
        if(params?.eventName === 'MODIFY' && params?.newImage?.type === 'application'
            && params?.newImage?.status === 'terminated'){
            await this.documentClient
                .put({
                    TableName: this.props.notificationTable,
                    Item: {
                        id: uuidv4(),
                        dateTime: now.toISOString(),
                        userId: params?.newImage?.workerId,
                        type: 'TRANSACTION_TERMINATED',
                        subjectId: params?.newImage?.customerId,
                        objectId: params?.newImage?.taskId,
                        transactionId: params?.newImage?.id,
                    },
                }).promise()
            await this.documentClient
                .put({
                    TableName: this.props.notificationTable,
                    Item: {
                        id: uuidv4(),
                        dateTime: now.toISOString(),
                        userId: params?.newImage?.customerId,
                        type: 'TRANSACTION_TERMINATED',
                        subjectId: params?.newImage?.workerId,
                        objectId: params?.newImage?.taskId,
                        transactionId: params?.newImage?.id,
                    },
                }).promise()
        }
        if(params?.eventName === 'MODIFY' &&
            params?.newImage?.lastMessage !== params?.oldImage?.lastMessage){
            await this.newMessageNotification(params?.newImage, task)
        }
    }

    async newMessageNotification(transaction: any, task: any): Promise<any> {
        const senderId = transaction.senderId
        const receiverId = transaction.receiverId
        const workerId = transaction.workerId
        const customerId = transaction.customerId
        const referrerId = transaction.referrerId
        const taskString = (task?.category? ' about ' + task?.category:'')
        if(receiverId){
            let role = 'Customer'
            let notificationType = 'Consumer/Messages'
            if(receiverId === customerId){
                role = 'Customer'
            }
            if(receiverId === workerId){
                role = 'Worker'
                notificationType = 'Worker/Messages'
            }
            if(receiverId === referrerId){
                role = 'Referral'
            }
            const senderProfile = await this.getProfile({
                userId: senderId
            })
            const receiverProfile = await this.getProfile({
                userId: receiverId
            })
            await this.sendPushNotification({
                notificationToken: receiverProfile?.notificationToken,
                title: `New Message For ${role}${taskString}.`,
                body: `${senderProfile?.name}: ${transaction?.lastMessage}`,
                data: {
                    transactionId: transaction.id,
                    notificationType: notificationType
                }
            })
        }
    }

    async updateProfile(params: any) {
        const now = new Date()
        await this.documentClient
            .update({
                TableName: this.props.profileTable,
                Key: {
                    userId: params.userId,
                },
                UpdateExpression: 'set lastSwipeNotificationTime = :lastSwipeNotificationTime',
                ExpressionAttributeValues : {
                    ':lastSwipeNotificationTime': now.getTime()
                }
            }).promise()
    }

    async sendCardAvailableNotification(params: any): Promise<any> {
        const now = new Date()
        const profile = await this.getProfile({
            userId: params.userId
        })
        if(profile && profile?.notificationToken &&
            (!profile?.lastSwipeNotificationTime ||
            (now.getTime() - profile?.lastSwipeNotificationTime > 43200000))){
            await this.updateProfile({
                userId: params.userId
            })
            let notificationType = 'Worker/Home'
            await this.sendPushNotification({
                notificationToken: profile?.notificationToken,
                title: 'New Tasks/Jobs are Available to Swipe.',
                body: 'There are new tasks available. You may now open the app and start swiping.',
                data: {
                    notificationType: notificationType
                }
            })
        }
    }

    async getProfile(params: any): Promise<any> {
        const response = await this.documentClient
            .get({
                TableName: this.props.profileTable,
                Key: {
                    userId: params.userId,
                },
            }).promise()
        return response.Item
    }

    async getTask(params: any): Promise<any> {
        const response = await this.documentClient
            .get({
                TableName: this.props.taskTable,
                Key: {
                    id: params.id,
                },
            }).promise()
        return response.Item
    }

    async sendNotification(params: any): Promise<any> {
        await this.documentClient
            .put({
                TableName: this.props.notificationTable,
                Item: {
                    id: uuidv4(),
                    dateTime: params.dateTime,
                    userId: params.userId,
                    type: params.notificationType,
                    subjectId: params.subjectId,
                    objectId: params.objectId,
                    transactionId: params.transactionId,
                },
            }).promise()
        const profile = await this.getProfile({
            userId: params.userId
        })
        await this.sendPushNotification({
            notificationToken: profile.notificationToken,
            title: params.notificationTitle,
            body: params.notificationBody,
            data: params.notificationData
        })
    }

    async sendPushNotification(params: any): Promise<any> {
        if (!Expo.isExpoPushToken('expo-push-token')) {
            console.error(`expo-push-token is not a valid Expo push token`)
        }
        const messages = []
        const message = {
            to: params.notificationToken,
            badge: 1,
            data: { extraData: params.data },
            title: params.title,
            body: params.body,
            sound: {
                critical: true,
                volume: 1
            }
        }
        messages.push(message)
        let chunks = this.expo.chunkPushNotifications(messages)
        const tickets = []

        for (const chunk of chunks) {
            try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk)
                tickets.push(...ticketChunk)
            } catch (error) {
                console.error(error)
            }
        }
    }

}
