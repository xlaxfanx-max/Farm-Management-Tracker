"""
Farm Management Tracker MCP Server

Main server module that registers all farm management tools
and handles the MCP protocol communication.

This server enables Claude Code to answer questions like:
- "Can I spray Block 5 today?"
- "When can I harvest the Navels?"
- "Am I on track with my water allocation?"
"""

import asyncio
import logging
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create the MCP server instance
server = Server("farm-management-tracker")


def register_tools():
    """Register all farm management tools with the server."""
    from mcp_server.tools import farm_tools
    from mcp_server.tools import weather_tools
    from mcp_server.tools import spray_tools
    from mcp_server.tools import harvest_tools
    from mcp_server.tools import compliance_tools
    from mcp_server.tools import water_tools

    # Collect all tool modules
    tool_modules = [
        farm_tools,
        weather_tools,
        spray_tools,
        harvest_tools,
        compliance_tools,
        water_tools,
    ]

    # Build the tools registry
    tools_registry = {}
    for module in tool_modules:
        for tool_def in module.TOOLS:
            tools_registry[tool_def['name']] = {
                'function': tool_def['function'],
                'description': tool_def['description'],
            }

    return tools_registry


# Initialize tools registry (will be populated after Django setup)
TOOLS_REGISTRY = {}


@server.list_tools()
async def list_tools() -> list[Tool]:
    """Return list of available tools."""
    global TOOLS_REGISTRY
    if not TOOLS_REGISTRY:
        TOOLS_REGISTRY = register_tools()

    tools = []
    for name, tool_info in TOOLS_REGISTRY.items():
        # Extract parameter info from function signature
        func = tool_info['function']
        import inspect
        sig = inspect.signature(func)

        # Build input schema from function parameters
        properties = {}
        required = []

        for param_name, param in sig.parameters.items():
            if param_name in ('self', 'cls'):
                continue

            # Determine type
            param_type = 'string'
            if param.annotation != inspect.Parameter.empty:
                if param.annotation == int:
                    param_type = 'integer'
                elif param.annotation == float:
                    param_type = 'number'
                elif param.annotation == bool:
                    param_type = 'boolean'
                elif hasattr(param.annotation, '__origin__'):
                    # Handle Optional[X]
                    if param.annotation.__origin__ is type(None):
                        pass
                    elif str(param.annotation).startswith('typing.Optional'):
                        inner = param.annotation.__args__[0]
                        if inner == int:
                            param_type = 'integer'
                        elif inner == float:
                            param_type = 'number'
                        elif inner == bool:
                            param_type = 'boolean'

            properties[param_name] = {'type': param_type}

            # Check if required (no default value)
            if param.default == inspect.Parameter.empty:
                required.append(param_name)

        tools.append(Tool(
            name=name,
            description=tool_info['description'],
            inputSchema={
                'type': 'object',
                'properties': properties,
                'required': required,
            }
        ))

    return tools


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Execute a tool and return results."""
    global TOOLS_REGISTRY
    if not TOOLS_REGISTRY:
        TOOLS_REGISTRY = register_tools()

    if name not in TOOLS_REGISTRY:
        return [TextContent(
            type='text',
            text=f'Error: Unknown tool "{name}". Use list_tools() to see available tools.'
        )]

    tool_func = TOOLS_REGISTRY[name]['function']

    try:
        # Call the async tool function
        result = await tool_func(**arguments)

        # Convert result to JSON string
        import json
        result_text = json.dumps(result, indent=2, default=str)

        return [TextContent(type='text', text=result_text)]

    except Exception as e:
        logger.exception(f"Error executing tool {name}")
        return [TextContent(
            type='text',
            text=f'Error executing {name}: {str(e)}'
        )]


async def main():
    """Run the MCP server."""
    logger.info("Starting Farm Management Tracker MCP Server...")

    # Run the server using stdio transport
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
