#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NotificationApiStack } from '../stack/notification-api-stack';
import {NotificationStatefulStack} from "../stack/notification-stateful-stack";

const app = new cdk.App();

const statefulStack = new NotificationStatefulStack(app, 'NotificationStatefulStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }})
new NotificationApiStack(app, 'NotificationApiStack', {
    notificationApiStatefulStack: statefulStack,
}, {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }
});
