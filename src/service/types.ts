export interface NotificationKeyParams {
    id: string
    fromUserId: string
    toUserId: string
}
export interface NotificationEntity {
    id?: string
    userId: string
    type: string
    subjectId: string
    objectId: string
    message: string
    dateTime?: string
}

export interface NotificationResponse {
    notifications: NotificationEntity[]
    lastEvaluatedKey?: string
    itemCount: number
}
