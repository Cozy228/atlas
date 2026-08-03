variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for the Atlas deployment."
}

variable "environment_name" {
  type        = string
  default     = "production-like"
  description = "Environment suffix used in resource names and tags."
}

variable "container_image" {
  type        = string
  description = "Container image for the Atlas Portal Hono server."
}

variable "container_port" {
  type        = number
  default     = 8080
  description = "Port exposed by the Atlas container."
}

variable "desired_count" {
  type        = number
  default     = 2
  description = "Number of Atlas ECS tasks to run."
}

variable "task_cpu" {
  type        = number
  default     = 512
  description = "Fargate task CPU units."
}

variable "task_memory" {
  type        = number
  default     = 1024
  description = "Fargate task memory in MiB."
}

variable "valkey_node_type" {
  type        = string
  default     = "cache.t4g.micro"
  description = "ElastiCache node type for the shared source-content cache."
}

variable "valkey_num_node_groups" {
  type        = number
  default     = 1
  description = "Number of shards in the cluster-mode Valkey replication group."

  validation {
    condition     = var.valkey_num_node_groups >= 1
    error_message = "valkey_num_node_groups must be at least 1."
  }
}

variable "valkey_replicas_per_node_group" {
  type        = number
  default     = 1
  description = "Number of replicas per Valkey shard. At least one is required for automatic failover."

  validation {
    condition     = var.valkey_replicas_per_node_group >= 1
    error_message = "valkey_replicas_per_node_group must be at least 1."
  }
}

variable "vpc_cidr" {
  type        = string
  default     = "10.42.0.0/16"
  description = "CIDR block for the Atlas VPC."
}

variable "alb_ingress_cidr_blocks" {
  type        = list(string)
  default     = ["0.0.0.0/0"]
  description = "CIDR blocks allowed to reach the public ALB."
}

variable "alb_certificate_arn" {
  type        = string
  default     = ""
  description = "Optional ACM certificate ARN. When unset, the ALB listener uses HTTP."
}

variable "portal_origin" {
  type        = string
  default     = ""
  description = "Canonical Portal origin. Leave empty to derive it from load-balancer headers."
}

variable "http_proxy" {
  type        = string
  default     = ""
  description = "Optional HTTP proxy URL for server-side outbound fetches."
  sensitive   = true
}

variable "https_proxy" {
  type        = string
  default     = ""
  description = "Optional HTTPS proxy URL for server-side outbound fetches."
  sensitive   = true
}

variable "no_proxy" {
  type        = string
  default     = ""
  description = "Optional comma-separated hosts that bypass the scoped outbound HTTP proxy."
}
