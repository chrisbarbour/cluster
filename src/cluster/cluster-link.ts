import { GLLine, Vertex, Vector2D } from 'simple-gl'
import ClusterNode from './cluster-node';

export default class ClusterLink extends GLLine{
    nodeA: ClusterNode
    nodeB: ClusterNode
    direction: ClusterLinkDirection
    constructor(nodeA: ClusterNode, nodeB: ClusterNode, direction: ClusterLinkDirection = ClusterLinkDirection.NONE){
        
        super(new Vertex(nodeA.position.translate(new Vector2D(0,0)), [0,0,0,0.2]), new Vertex(nodeB.position.translate(new Vector2D(0,0)), [0,0,0,0.2]))
        this.nodeA = nodeA
        this.nodeB = nodeB
        this.direction = direction
    }

    transformedVerticies(): Array<Vertex>{
        return [
            new Vertex(this.nodeA.transform.transform().transform(this.nodeA.position), this.a.color),
            new Vertex(this.nodeB.transform.transform().transform(this.nodeB.position), this.b.color)
        ]
    }
}
export enum ClusterLinkDirection{ FORWARD, BACKWARD, BOTH, NONE }