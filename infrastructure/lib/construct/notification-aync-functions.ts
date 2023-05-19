import {Construct} from "constructs"
import {GenericAsyncFunction} from "../generic/GenericAsyncFunction"
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {DynamoEventSource} from "aws-cdk-lib/aws-lambda-event-sources";
import {StartingPosition} from "aws-cdk-lib/aws-lambda"
import {GenericDynamoTable} from "../generic/GenericDynamoTable";
import config from "../../config/config";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {ITable, Table} from "aws-cdk-lib/aws-dynamodb";

export interface NotificationAsyncProps {
    notificationTable: GenericDynamoTable,
}

export class NotificationAyncFunctions extends GenericAsyncFunction {
    transactionTableStream: NodejsFunction
    cardTableStream: NodejsFunction
    props: NotificationAsyncProps

    public constructor(scope: Construct, id: string, props: NotificationAsyncProps) {
        super(scope, id)
        this.props = props
        this.initializeFunctions()
    }

    private initializeFunctions() {
        const profileTable = this.getProfileTable()
        const taskTable = this.getTaskTable()
        const transactionTable = this.getTransactionTable()
        const cardTable = this.getCardTable()

        this.transactionTableStream = this.addFunction({
            functionName: 'transaction-table-stream-handler',
            handlerName: 'transaction-table-stream-handler.ts',
            environment: {
                TASK_TABLE: taskTable.tableName,
                PROFILE_TABLE: profileTable.tableName,
                TRANSACTION_TABLE: transactionTable.tableName,
                CARD_TABLE: cardTable.tableName,
                NOTIFICATION_TABLE: this.props.notificationTable.table.tableName,
                EXPO_ACCESS_TOKEN: config.expoNotificationAccessToken,
            },
            externalModules: []
        })

        this.cardTableStream = this.addFunction({
            functionName: 'card-table-stream-handler',
            handlerName: 'card-table-stream-handler.ts',
            environment: {
                TASK_TABLE: taskTable.tableName,
                PROFILE_TABLE: profileTable.tableName,
                TRANSACTION_TABLE: transactionTable.tableName,
                CARD_TABLE: cardTable.tableName,
                NOTIFICATION_TABLE: this.props.notificationTable.table.tableName,
                EXPO_ACCESS_TOKEN: config.expoNotificationAccessToken,
            },
            externalModules: []
        })

        this.transactionTableStream.addEventSource(new DynamoEventSource(
            transactionTable, {
                startingPosition: StartingPosition.LATEST,
                reportBatchItemFailures: true,
                retryAttempts: 2
            }))

        this.cardTableStream.addEventSource(new DynamoEventSource(
            cardTable, {
                startingPosition: StartingPosition.LATEST,
                reportBatchItemFailures: true,
                retryAttempts: 2
            }))

        this.props.notificationTable.table.grantFullAccess(this.transactionTableStream.grantPrincipal)
        this.props.notificationTable.table.grantFullAccess(this.cardTableStream.grantPrincipal)

        profileTable.grantFullAccess(this.transactionTableStream.grantPrincipal)
        profileTable.grantFullAccess(this.cardTableStream.grantPrincipal)

        taskTable.grantFullAccess(this.transactionTableStream.grantPrincipal)
        taskTable.grantFullAccess(this.cardTableStream.grantPrincipal)

        transactionTable.grantFullAccess(this.transactionTableStream.grantPrincipal)
        transactionTable.grantFullAccess(this.cardTableStream.grantPrincipal)

        cardTable.grantFullAccess(this.transactionTableStream.grantPrincipal)
        cardTable.grantFullAccess(this.cardTableStream.grantPrincipal)
    }

    public getProfileTable() : ITable {
        return Table.fromTableAttributes(this, 'profileTableId', {
            tableArn: config.profileTableArn,
            tableStreamArn: config.profileTableArnStream,
        })
    }

    public getTaskTable() : ITable {
        return Table.fromTableAttributes(this, 'taskTableId', {
            tableArn: config.taskTableArn,
            tableStreamArn: config.taskTableArnStream
        })
    }

    public getTransactionTable() : ITable {
        return Table.fromTableAttributes(this, 'transactionTableId', {
            tableArn: config.transactionTableArn,
            tableStreamArn: config.transactionTableArnStream
        })
    }

    public getCardTable() : ITable {
        return Table.fromTableAttributes(this, 'cardTableId', {
            tableArn: config.cardTableArn,
            tableStreamArn: config.cardTableArnStream
        })
    }

}
