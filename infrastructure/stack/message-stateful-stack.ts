import * as cdk from 'aws-cdk-lib';
import {CfnOutput, Fn, RemovalPolicy, Stack} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {GenericDynamoTable} from "../lib/generic/GenericDynamoTable";
import {AttributeType, StreamViewType} from "aws-cdk-lib/aws-dynamodb";
import config from "../config/config";
import {Bucket, HttpMethods} from "aws-cdk-lib/aws-s3";
import {Effect, PolicyStatement, Role} from "aws-cdk-lib/aws-iam";


export class MessageStatefulStack extends Stack {
    public dynamodbTable: GenericDynamoTable
    private suffix: string
    public messageImageBucket: Bucket

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        this.initializeSuffix()
        this.initializeDynamoDBTable()
        this.initializeMessagePhotosBucket()
        this.initializeMessageBucketPolicies()
    }

    private initializeSuffix() {
        const shortStackId = Fn.select(2, Fn.split('/', this.stackId));
        const Suffix = Fn.select(4, Fn.split('-', shortStackId));
        this.suffix = Suffix;
    }

    private initializeDynamoDBTable() {
        this.dynamodbTable = new GenericDynamoTable(this, 'MessageDynamoDBTable', {
            tableName: `Message-${config.envName}-${this.suffix}`,
            primaryKey: 'id',
            // stream: StreamViewType.NEW_AND_OLD_IMAGES,
            keyType: AttributeType.STRING,
        })
        this.dynamodbTable.addSecondaryIndexes({
            indexName: "user-index",
            partitionKeyName: "fromUserId",
            partitionKeyType: AttributeType.STRING,
            sortKeyName: 'toUserId',
            sortKeyType: AttributeType.NUMBER,
        })
    }

    private initializeMessagePhotosBucket() {
        this.messageImageBucket = new Bucket(this, 'message-image', {
            removalPolicy: RemovalPolicy.DESTROY,
            bucketName: `message-image-${config.envName}-${this.suffix}`,
            cors: [{
                allowedMethods: [
                    HttpMethods.HEAD,
                    HttpMethods.GET,
                    HttpMethods.PUT
                ],
                allowedOrigins: ['*'],
                allowedHeaders: ['*']
            }]
        });
        new CfnOutput(this, 'message-image-bucket-name', {
            value: this.messageImageBucket.bucketName
        })
    }

    private initializeMessageBucketPolicies() {
        const authenticatedRole = Role.fromRoleArn(
            this, 'authenticatedRoleMessage', config.authenticatedRoleArn)
        const adminRole = Role.fromRoleArn(
            this, 'adminRoleMessage', config.adminRoleArn)
        const uploadBucketPolicy = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                's3:PutObject',
                's3:PutObjectAcl',
                's3:GetObject',
                's3:DeleteObject'
            ],
            resources: [this.messageImageBucket.bucketArn + '/*']
        })
        authenticatedRole.addToPrincipalPolicy(uploadBucketPolicy)
        adminRole.addToPrincipalPolicy(uploadBucketPolicy)
    }

}
