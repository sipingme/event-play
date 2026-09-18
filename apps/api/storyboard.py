from typing import Literal
from pydantic import BaseModel, Field, model_validator

KINDS = {'gather': 0, 'teams': 1, 'message': 1, 'countdown': 2, 'race': 3, 'awards': 4, 'celebrate': 5}


class StoryNode(BaseModel):
    id: str = Field(pattern=r'^[A-Za-z0-9_-]{1,64}$')
    kind: Literal['gather', 'teams', 'message', 'countdown', 'race', 'awards', 'celebrate']
    x: float = Field(ge=0, le=1800, allow_inf_nan=False)
    y: float = Field(ge=0, le=1600, allow_inf_nan=False)
    title: str = Field(min_length=1, max_length=60)
    caption: str = Field(default='', max_length=200)
    seconds: int = Field(ge=1, le=15, strict=True)


class StoryEdge(BaseModel):
    source: str = Field(max_length=64)
    target: str = Field(max_length=64)


class Storyboard(BaseModel):
    version: Literal[1] = 1
    nodes: list[StoryNode] = Field(min_length=1, max_length=10)
    edges: list[StoryEdge] = Field(max_length=10)

    @model_validator(mode='after')
    def structure(self):
        ids = [node.id for node in self.nodes]
        if len(set(ids)) != len(ids):
            raise ValueError('故事板节点标识重复')
        if any(edge.source not in ids or edge.target not in ids for edge in self.edges):
            raise ValueError('故事板连线引用不存在的节点')
        return self

    def publish_error(self):
        nodes = {node.id: node for node in self.nodes}
        for kind in ['gather', 'race', 'awards']:
            if sum(node.kind == kind for node in self.nodes) != 1:
                return '故事板必须包含唯一的集结、比赛、颁奖节点'
        incoming, outgoing = {}, {}
        for edge in self.edges:
            source, target = nodes[edge.source], nodes[edge.target]
            if edge.source == edge.target or edge.source in outgoing or edge.target in incoming:
                return '故事板不支持自连、分支或合流'
            if target.kind == 'gather' or source.kind == 'celebrate' or KINDS[source.kind] > KINDS[target.kind]:
                return '故事板阶段连接顺序不正确'
            outgoing[edge.source], incoming[edge.target] = edge.target, edge.source
        cursor = next(node.id for node in self.nodes if node.kind == 'gather')
        seen = set()
        while cursor is not None:
            if cursor in seen:
                return '故事板不允许循环'
            seen.add(cursor)
            cursor = outgoing.get(cursor)
        if len(seen) != len(nodes) or len(self.edges) != len(nodes) - 1:
            return '故事板有未连接的节点，请完成连线后发布'
        if any(not node.title.strip() for node in self.nodes):
            return '请填写故事板节点标题'
        return None
