import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Get the latest Amazon Linux 2 AMI
const ami = aws.ec2.getAmi({
    filters: [
        { name: "name", values: ["amzn2-ami-hvm-*-x86_64-gp2"] },
    ],
    owners: ["137112412989"], // Amazon
    mostRecent: true,
});

// Create a Security Group to allow HTTP access
const group = new aws.ec2.SecurityGroup("web-secgrp", {
    description: "Enable HTTP access",
    ingress: [
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
    ],
    egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
    ],
});

// Create an EC2 instance
const server = new aws.ec2.Instance("web-server", {
    instanceType: "t2.micro",
    vpcSecurityGroupIds: [group.id],
    ami: ami.then(ami => ami.id),
    tags: {
        Name: "pulumi-managed-instance",
    },
});

export const publicIp = server.publicIp;
export const publicHostName = server.publicDns;
