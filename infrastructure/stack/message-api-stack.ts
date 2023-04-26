import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {Stack} from "aws-cdk-lib";
import {MessageApis} from "../lib/construct/message-apis";
import {MessageStatefulStack} from "./message-stateful-stack";

export interface TodoAppProps{
  categoryApiStatefulStack: MessageStatefulStack
}

export class MessageApiStack extends Stack {

  public categoryApis:MessageApis

  constructor(scope: Construct, id: string, todoAppProps: TodoAppProps,  props?: cdk.StackProps) {
    super(scope, id, props);
    this.categoryApis = new MessageApis(this,id, {
      dynamoDBTable: todoAppProps.categoryApiStatefulStack.dynamodbTable,
    })
  }


}
