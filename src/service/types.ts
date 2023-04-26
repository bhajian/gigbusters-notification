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
    message: string
    dateTime?: string
}

export interface NotificationResponse {
    messages: NotificationEntity[]
    lastEvaluatedKey?: string
    itemCount: number
}
