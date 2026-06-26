# AWS-Federated Service Availability across Global STT Regions

**Legend**

* ✅ = Available
* `:emo:` = Interim availability
* ↗️ = Future availability
* X = Not planned

*STT standard Modernization levels and Landing Zone definitions referenced below can be located via this [link](#).*


## Global STT Regions

| Service | US-EAST-1 (North Virginia) | CA-CENTRAL-1 (Canada Central) |
| :--- | :--- | :--- |
| **Landing Zones** | ✅ L3 - L5 | ✅ L3 - L5 |
| **Storage** | | |
| S3 | ✅ | ✅ |
| Elastic File System (EFS) | ✅ | ✅ |
| Elastic Block Storage (EBS) | ✅ | ✅ |
| AWS Backup | ✅ | ✅ |
| **Compute** | | |
| EC2 | ✅ | ✅ |
| Lambda | ✅ | ✅ |
| **Containers** | | |
| AWS ECS Fargate | ✅ | ✅ |
| Elastic Container Registry | ✅ | ✅ |
| Elastic Kubernetes Service (EKS)| ✅ | ✅ |
| **Database** | | |
| Aurora Serverless v2 (PostgreSQL)| ✅ | ✅ |
| ElastiCache | ✅ | ✅ |
| **Analytics** | | |
| Kinesis | ✅ | ✅ |
| AWS Glue | ✅ | ✅ |
| Athena | ✅ | ✅ |
| **Application Integration** | | |
| Simple Queue Service (SQS) | ✅ | ✅ |
| Simple Notification Service (SNS)| ✅ | ✅ |
| AWS EventBridge | ✅ | ✅ |
| Managed Apache Airflow | ✅ | ✅ |
| Step Function | ✅ | ✅ |
| **Migration & Transfer** | | |
| Transfer Family | ✅ | ✅ |
| Database Migration Service (DMS) | ↗️ 05/30/2026 | ↗️ 05/30/2026 |
| **AI Services** | | |
| Amazon Bedrock | ✅ | ✅ |
| Amazon Bedrock AgentCore | ✅ | ✅ |
| Amazon Textract | ✅ | ✅ |

## Outposts

| Service | GDC (Primary) | DC16 (DR) | MT10 (Future DR) |
| :--- | :--- | :--- | :--- |
| **Compute** | | | |
| EC2 | ↗️ 05/30/2026 | ↗️ 07/31/2026 | ↗️ TBD |
| **Containers** | | | |
| AWS ECS EC2 | ↗️ 06/30/2026 | ↗️ 07/31/2026 | ↗️ TBD |
| **Networking & Content Delivery**| | | |
| Elastic Load Balancing (ELB) | ↗️ 06/30/2026 | ↗️ 06/30/2026 | ↗️ TBD |
