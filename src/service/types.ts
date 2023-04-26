export interface MessageKeyParams {
    id: string
    fromUserId: string
    toUserId: string
}
export interface MessageEntity {
    id?: string
    fromUserId: string
    toUserId: string
    message: string
    dateTime?: string
}

export interface MessageResponse {
    messages: MessageEntity[]
    lastEvaluatedKey?: string
    itemCount: number
}
