terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix = "atlas-${var.environment_name}"

  common_tags = {
    Application = "atlas"
    Environment = var.environment_name
  }
}

resource "aws_vpc" "atlas" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = local.name_prefix
  })
}

resource "aws_internet_gateway" "atlas" {
  vpc_id = aws_vpc.atlas.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.atlas.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${count.index + 1}"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.atlas.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.atlas.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public"
  })
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "Public ALB ingress for Atlas"
  vpc_id      = aws_vpc.atlas.id

  ingress {
    from_port   = var.alb_certificate_arn == "" ? 80 : 443
    to_port     = var.alb_certificate_arn == "" ? 80 : 443
    protocol    = "tcp"
    cidr_blocks = var.alb_ingress_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb"
  })
}

resource "aws_security_group" "ecs_tasks" {
  name        = "${local.name_prefix}-tasks"
  description = "Atlas ECS task ingress from the ALB"
  vpc_id      = aws_vpc.atlas.id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-tasks"
  })
}

resource "aws_security_group" "valkey" {
  name        = "${local.name_prefix}-valkey"
  description = "Atlas ElastiCache (Valkey) ingress from the ECS tasks"
  vpc_id      = aws_vpc.atlas.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-valkey"
  })
}

# ElastiCache IAM-auth user. Its user_name is the identity the app authenticates
# as; it MUST equal CACHE_VALKEY_USERNAME wired into the task (see the container
# environment below). GLIDE mints the IAM token at connect time — no password is
# stored anywhere. The task role is granted elasticache:Connect for this user.
resource "aws_elasticache_user" "valkey_iam" {
  user_id       = "${local.name_prefix}-app"
  user_name     = "${local.name_prefix}-app"
  engine        = "valkey"
  access_string = "on ~* +@all"

  authentication_mode {
    type = "iam"
  }

  tags = local.common_tags
}

# A user group must include a "default" user; keep it disabled (no-access) so the
# only usable identity is the IAM user above.
resource "aws_elasticache_user" "valkey_default" {
  user_id       = "${local.name_prefix}-default"
  user_name     = "default"
  engine        = "valkey"
  access_string = "off -@all"

  authentication_mode {
    type = "no-password-required"
  }

  tags = local.common_tags
}

resource "aws_elasticache_user_group" "valkey" {
  user_group_id = local.name_prefix
  engine        = "valkey"
  user_ids = [
    aws_elasticache_user.valkey_default.user_id,
    aws_elasticache_user.valkey_iam.user_id,
  ]

  tags = local.common_tags
}

# Serverless Valkey: a KV+TTL workload (content cache + sessions in distinct
# keyspaces). Serverless avoids node sizing and matches the bursty access shape.
resource "aws_elasticache_serverless_cache" "valkey" {
  name   = "${local.name_prefix}-valkey"
  engine = "valkey"

  cache_usage_limits {
    data_storage {
      maximum = var.valkey_max_storage_gb
      unit    = "GB"
    }

    ecpu_per_second {
      maximum = var.valkey_max_ecpu
    }
  }

  security_group_ids = [aws_security_group.valkey.id]
  subnet_ids         = aws_subnet.public[*].id
  user_group_id      = aws_elasticache_user_group.valkey.user_group_id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-valkey"
  })
}

# Session signing key + Entra confidential-client certificate live here; content
# is populated out-of-band (never in Terraform state or this repo). The task role
# already holds secretsmanager:GetSecretValue for both the runtime and this secret.
resource "aws_secretsmanager_secret" "session" {
  name = "${local.name_prefix}/session"

  tags = local.common_tags
}

resource "aws_lb" "portal" {
  name               = "${local.name_prefix}-portal"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-portal"
  })
}

resource "aws_lb_target_group" "portal" {
  name        = "${local.name_prefix}-portal"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.atlas.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200-399"
    path                = "/"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "portal" {
  load_balancer_arn = aws_lb.portal.arn
  port              = var.alb_certificate_arn == "" ? 80 : 443
  protocol          = var.alb_certificate_arn == "" ? "HTTP" : "HTTPS"
  certificate_arn   = var.alb_certificate_arn == "" ? null : var.alb_certificate_arn
  ssl_policy        = var.alb_certificate_arn == "" ? null : "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.portal.arn
  }
}

resource "aws_dynamodb_table" "feedback" {
  name         = "${local.name_prefix}-feedback"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name            = "gsi1"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-feedback"
  })
}

resource "aws_dynamodb_table" "apps" {
  name         = "${local.name_prefix}-apps"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name            = "gsi1"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-apps"
  })
}

# Durable change feed (Step 2, M1): append-only, content-hash-idempotent
# ChangeEvents. Single-table pk/sk + one time-ordered gsi1 partition for
# `since=` incremental reads. Same house style as apps/feedback.
resource "aws_dynamodb_table" "events" {
  name         = "${local.name_prefix}-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  attribute {
    name = "gsi1sk"
    type = "S"
  }

  global_secondary_index {
    name            = "gsi1"
    hash_key        = "gsi1pk"
    range_key       = "gsi1sk"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-events"
  })
}

resource "aws_secretsmanager_secret" "runtime" {
  name = "${local.name_prefix}/runtime"

  tags = local.common_tags
}

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name_prefix}-task-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# The EXECUTION role (not the task role) resolves container `secrets` at launch,
# so it needs read access to every secret the task def injects via valueFrom.
resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "${local.name_prefix}-task-execution-secrets"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = ["secretsmanager:GetSecretValue"]
        Effect = "Allow"
        Resource = [
          aws_secretsmanager_secret.runtime.arn,
          aws_secretsmanager_secret.session.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "task" {
  name               = "${local.name_prefix}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = local.common_tags
}

resource "aws_iam_role_policy" "task" {
  name = "${local.name_prefix}-task"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:PutItem",
          "dynamodb:Scan"
        ]
        Effect = "Allow"
        Resource = [
          aws_dynamodb_table.feedback.arn,
          "${aws_dynamodb_table.feedback.arn}/index/*",
          aws_dynamodb_table.apps.arn,
          "${aws_dynamodb_table.apps.arn}/index/*",
          aws_dynamodb_table.events.arn,
          "${aws_dynamodb_table.events.arn}/index/*"
        ]
      },
      {
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Effect = "Allow"
        Resource = [
          aws_secretsmanager_secret.runtime.arn,
          aws_secretsmanager_secret.session.arn
        ]
      },
      {
        # IAM-auth connect to the Valkey cache as the RBAC user (no password).
        Action = ["elasticache:Connect"]
        Effect = "Allow"
        Resource = [
          aws_elasticache_serverless_cache.valkey.arn,
          aws_elasticache_user.valkey_iam.arn
        ]
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "portal" {
  name              = "/ecs/${local.name_prefix}-portal"
  retention_in_days = 14

  tags = local.common_tags
}

resource "aws_ecs_cluster" "atlas" {
  name = local.name_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "portal" {
  family                   = "${local.name_prefix}-portal"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = "atlas-portal"
      image     = var.container_image
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = tostring(var.container_port) },
        { name = "PORTAL_ORIGIN", value = var.portal_origin },
        { name = "FEEDBACK_TABLE", value = aws_dynamodb_table.feedback.name },
        { name = "APPS_TABLE", value = aws_dynamodb_table.apps.name },
        { name = "EVENTS_TABLE", value = aws_dynamodb_table.events.name },
        # Enables the lifecycle-plane graph snapshot refresh (15 min cadence; unset = off).
        { name = "GRAPH_REFRESH_INTERVAL_MS", value = "900000" },
        { name = "RUNTIME_SECRET", value = aws_secretsmanager_secret.runtime.name },
        { name = "AWS_REGION", value = var.aws_region },
        # Content cache + session store share one serverless cache, distinct keyspaces.
        # IAM auth: no password — GLIDE mints the token from the task role.
        { name = "CACHE_VALKEY_URL", value = "rediss://${aws_elasticache_serverless_cache.valkey.endpoint[0].address}:${aws_elasticache_serverless_cache.valkey.endpoint[0].port}" },
        { name = "CACHE_VALKEY_USERNAME", value = aws_elasticache_user.valkey_iam.user_name },
        { name = "CACHE_VALKEY_IAM_CLUSTER", value = aws_elasticache_serverless_cache.valkey.name },
        { name = "SESSION_VALKEY_URL", value = "rediss://${aws_elasticache_serverless_cache.valkey.endpoint[0].address}:${aws_elasticache_serverless_cache.valkey.endpoint[0].port}" }
      ]

      # Sensitive values injected by ECS from Secrets Manager as env vars at launch.
      # Each entry pulls one JSON key from a secret; the secret CONTENTS are managed
      # out-of-band and never live in Terraform state or this repo (ADR-0004).
      # Source-system tokens live in the runtime secret; session/Entra keys in the
      # session secret. Valkey is absent here on purpose — it is IAM-auth, no secret.
      secrets = [
        { name = "CONFLUENCE_TOKEN", valueFrom = "${aws_secretsmanager_secret.runtime.arn}:CONFLUENCE_TOKEN::" },
        { name = "CONFLUENCE_SECURITY_TOKEN", valueFrom = "${aws_secretsmanager_secret.runtime.arn}:CONFLUENCE_SECURITY_TOKEN::" },
        { name = "TERRAFORM_TOKEN", valueFrom = "${aws_secretsmanager_secret.runtime.arn}:TERRAFORM_TOKEN::" },
        { name = "SESSION_SECRET", valueFrom = "${aws_secretsmanager_secret.session.arn}:SESSION_SECRET::" },
        { name = "ENTRA_CLIENT_CERT", valueFrom = "${aws_secretsmanager_secret.session.arn}:ENTRA_CLIENT_CERT::" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.portal.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "portal"
        }
      }
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "portal" {
  name                               = "${local.name_prefix}-portal"
  cluster                            = aws_ecs_cluster.atlas.id
  task_definition                    = aws_ecs_task_definition.portal.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 60
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 50

  network_configuration {
    assign_public_ip = true
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = aws_subnet.public[*].id
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.portal.arn
    container_name   = "atlas-portal"
    container_port   = var.container_port
  }

  depends_on = [aws_lb_listener.portal]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "portal_unhealthy_hosts" {
  alarm_name          = "${local.name_prefix}-portal-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 0

  dimensions = {
    LoadBalancer = aws_lb.portal.arn_suffix
    TargetGroup  = aws_lb_target_group.portal.arn_suffix
  }

  tags = local.common_tags
}
