import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {Stack} from "aws-cdk-lib";
import {NotificationApis} from "../lib/construct/notification-apis";
import {NotificationStatefulStack} from "./notification-stateful-stack";

export interface TodoAppProps{
  notificationApiStatefulStack: NotificationStatefulStack
}

export class NotificationApiStack extends Stack {

  public notificationApis:NotificationApis

  constructor(scope: Construct, id: string, todoAppProps: TodoAppProps,  props?: cdk.StackProps) {
    super(scope, id, props);
    this.notificationApis = new NotificationApis(this,id, {
      dynamoDBTable: todoAppProps.notificationApiStatefulStack.dynamodbTable,
    })
  }


}
