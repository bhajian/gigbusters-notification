import {JsonSchemaType} from "aws-cdk-lib/aws-apigateway";

export const putMessageSchema = {
    type: JsonSchemaType.OBJECT,
    required: [
        "category", "ranking"
    ],
    properties: {
        category: {
            type: JsonSchemaType.STRING
        },
        ranking: {
            type: JsonSchemaType.NUMBER
        },
    },
}
