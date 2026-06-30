output "portal_alb_dns_name" {
  value       = aws_lb.portal.dns_name
  description = "DNS name of the Atlas public Application Load Balancer."
}

output "feedback_table_name" {
  value       = aws_dynamodb_table.feedback.name
  description = "DynamoDB table used by the Context Layer feedback repository."
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.atlas.name
  description = "ECS cluster running the Atlas portal service."
}
