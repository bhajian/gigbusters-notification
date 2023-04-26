#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MessageApiStack } from '../stack/message-api-stack';
import {MessageStatefulStack} from "../stack/message-stateful-stack";

const app = new cdk.App();

const statefulStack = new MessageStatefulStack(app, 'MessageStatefulStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }})
new MessageApiStack(app, 'MessageApiStack', {
    categoryApiStatefulStack: statefulStack,
}, {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }
});
