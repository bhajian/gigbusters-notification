import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {Stack} from "aws-cdk-lib";
import {NotificationApis} from "../lib/construct/notification-apis";
import {NotificationStatefulStack} from "./notification-stateful-stack";
import {NotificationAyncFunctions} from "../lib/construct/notification-aync-functions";

export interface NotificationProps {
  notificationApiStatefulStack: NotificationStatefulStack
}

export class NotificationApiStack extends Stack {

  public notificationApis: NotificationApis
  public notificationFunctions: NotificationAyncFunctions

  constructor(scope: Construct, id: string,
              notificationProps: NotificationProps, props?: cdk.StackProps) {
    super(scope, id, props)
    this.notificationApis = new NotificationApis(this,id, {
      dynamoDBTable: notificationProps.notificationApiStatefulStack.dynamodbTable,
    })

    this.notificationFunctions = new NotificationAyncFunctions(this, 'taskAsyncFunctionsId', {
      notificationTable: notificationProps.notificationApiStatefulStack.dynamodbTable,
    })

  }

}
