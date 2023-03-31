import {Construct} from "constructs";
import {GenericDynamoTable} from "../generic/GenericDynamoTable";
import {GenericApi} from "../generic/GenericApi";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {putMessageSchema} from "./message-schema";
import {CognitoUserPoolsAuthorizer, IResource} from "aws-cdk-lib/aws-apigateway";
import {AuthorizationType} from "@aws-cdk/aws-apigateway";
import config from "../../config/config";
import {Table} from "aws-cdk-lib/aws-dynamodb";
import {UserPool} from "aws-cdk-lib/aws-cognito";

export interface ApiProps {
    dynamoDBTable: GenericDynamoTable
}

export interface AuthorizerProps {
    id: string
    authorizerName: string
    identitySource: string
    userPoolArn: string
}

export interface MessageApiProps {
    table: Table
    authorizer: CognitoUserPoolsAuthorizer
    rootResource: IResource
    idResource: IResource
}

export class MessageApis extends GenericApi {
    private listApi: NodejsFunction
    private putApi: NodejsFunction
    private getApi: NodejsFunction
    private deleteApi: NodejsFunction

    public constructor(scope: Construct, id: string, props: ApiProps) {
        super(scope, id)
        this.initializeApis(props);
        this.initializeDomainName({
            certificateArn: config.apiDomainCertificateArn,
            apiSubdomain: config.apiSubdomain,
            domainNameId: 'domainNameId',
            rootDomain: config.rootDomain,
            ARecordId: 'ARecordId',
            basePath: config.basePath,
            envName: config.envName
        })
    }

    private initializeApis(props: ApiProps){
        const authorizer = this.createAuthorizer({
            id: 'userAuthorizerId',
            authorizerName: 'userAuthorizer',
            identitySource: 'method.request.header.Authorization',
            userPoolArn: config.userPoolArn
        })

        const idResource = this.api.root.addResource('{id}')
        this.initializeMessageApis({
            authorizer: authorizer,
            idResource: idResource,
            rootResource: this.api.root,
            table: props.dynamoDBTable.table
        })

    }

    private initializeMessageApis(props: MessageApiProps){
        this.listApi = this.addMethod({
            functionName: 'message-list',
            handlerName: 'message-list-handler.ts',
            verb: 'GET',
            resource: props.rootResource,
            environment: {
                TABLE: props.table.tableName
            },
            validateRequestBody: false,
            authorizationType: AuthorizationType.COGNITO,
            authorizer: props.authorizer
        })

        this.putApi = this.addMethod({
            functionName: 'message-put',
            handlerName: 'message-put-handler.ts',
            verb: 'PUT',
            resource: props.rootResource,
            environment: {
                TABLE: props.table.tableName
            },
            validateRequestBody: true,
            bodySchema: putMessageSchema,
            authorizationType: AuthorizationType.COGNITO,
            authorizer: props.authorizer
        })

        props.table.grantFullAccess(this.listApi.grantPrincipal)
        props.table.grantFullAccess(this.putApi.grantPrincipal)
    }

    protected createAuthorizer(props: AuthorizerProps): CognitoUserPoolsAuthorizer{
        const userPool = UserPool.fromUserPoolArn(this,'userPoolId', props.userPoolArn)
        const authorizer = new CognitoUserPoolsAuthorizer(
            this,
            props.id,
            {
                cognitoUserPools: [userPool],
                authorizerName: props.authorizerName,
                identitySource: props.identitySource
            });
        authorizer._attachToApi(this.api)
        return authorizer
    }

}
