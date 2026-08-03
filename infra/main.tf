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

resource "aws_security_group" "content_cache" {
  name        = "${local.name_prefix}-content-cache"
  description = "Valkey ingress from Atlas ECS tasks"
  vpc_id      = aws_vpc.atlas.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-content-cache"
  })
}

resource "aws_elasticache_subnet_group" "content_cache" {
  name       = "${local.name_prefix}-content-cache"
  subnet_ids = aws_subnet.public[*].id

  tags = local.common_tags
}

resource "aws_elasticache_user" "content_cache_default" {
  user_id       = "${local.name_prefix}-cache-default"
  user_name     = "default"
  access_string = "off ~* -@all"
  engine        = "valkey"

  authentication_mode {
    type = "no-password-required"
  }

  tags = local.common_tags
}

resource "aws_elasticache_user" "content_cache" {
  user_id       = "${local.name_prefix}-portal"
  user_name     = "${local.name_prefix}-portal"
  access_string = "on ~atlas:source-content:* +@read +@write +@connection +cluster|slots +cluster|shards +cluster|info"
  engine        = "valkey"

  authentication_mode {
    type = "iam"
  }

  tags = local.common_tags
}

resource "aws_elasticache_user_group" "content_cache" {
  user_group_id = "${local.name_prefix}-content-cache"
  engine        = "valkey"
  user_ids = [
    aws_elasticache_user.content_cache_default.user_id,
    aws_elasticache_user.content_cache.user_id
  ]

  tags = local.common_tags
}

resource "aws_elasticache_replication_group" "content_cache" {
  replication_group_id       = "${local.name_prefix}-content-cache"
  description                = "Shared Atlas source-content cache"
  engine                     = "valkey"
  engine_version             = "7.2"
  node_type                  = var.valkey_node_type
  port                       = 6379
  num_node_groups            = var.valkey_num_node_groups
  replicas_per_node_group    = var.valkey_replicas_per_node_group
  automatic_failover_enabled = true
  multi_az_enabled           = true
  subnet_group_name          = aws_elasticache_subnet_group.content_cache.name
  security_group_ids         = [aws_security_group.content_cache.id]
  user_group_ids             = [aws_elasticache_user_group.content_cache.user_group_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  apply_immediately          = true

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
  name                 = "${local.name_prefix}-portal"
  port                 = var.container_port
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = aws_vpc.atlas.id
  deregistration_delay = 30

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200-399"
    path                = "/health"
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
          "${aws_dynamodb_table.feedback.arn}/index/*"
        ]
      },
      {
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Effect   = "Allow"
        Resource = aws_secretsmanager_secret.runtime.arn
      },
      {
        Action = [
          "elasticache:Connect"
        ]
        Effect = "Allow"
        Resource = [
          aws_elasticache_replication_group.content_cache.arn,
          aws_elasticache_user.content_cache.arn
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

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name        = "atlas-portal"
      image       = var.container_image
      essential   = true
      stopTimeout = 30

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = concat(
        [
          { name = "NODE_ENV", value = "production" },
          { name = "PORT", value = tostring(var.container_port) },
          { name = "PORTAL_ORIGIN", value = var.portal_origin },
          { name = "FEEDBACK_TABLE", value = aws_dynamodb_table.feedback.name },
          { name = "CACHE_VALKEY_URL", value = "rediss://${aws_elasticache_replication_group.content_cache.configuration_endpoint_address}:6379" },
          { name = "CACHE_VALKEY_CACHE_NAME", value = aws_elasticache_replication_group.content_cache.replication_group_id },
          { name = "CACHE_VALKEY_REGION", value = var.aws_region },
          { name = "CACHE_VALKEY_USER_ID", value = aws_elasticache_user.content_cache.user_id },
          { name = "CACHE_TTL_SECONDS", value = "300" },
          { name = "CACHE_NEGATIVE_TTL_SECONDS", value = "30" },
          { name = "CACHE_VALIDATION_TTL_SECONDS", value = "300" },
          { name = "CACHE_CONTENT_TTL_SECONDS", value = "604800" },
          { name = "RUNTIME_SECRET", value = aws_secretsmanager_secret.runtime.name }
        ],
        var.http_proxy != "" ? [{ name = "HTTP_PROXY", value = var.http_proxy }] : [],
        var.https_proxy != "" ? [{ name = "HTTPS_PROXY", value = var.https_proxy }] : [],
        var.no_proxy != "" ? [{ name = "NO_PROXY", value = var.no_proxy }] : []
      )

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
