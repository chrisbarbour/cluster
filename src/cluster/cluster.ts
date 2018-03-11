import ClusterNode from './cluster-node'
import ClusterLink from './cluster-link'
import ClusterGrid from './cluster-grid'
import { ClusterLinkDirection } from './cluster-link'
import { Vector3D, Vector2D } from 'simple-gl'

export default class Cluster{
    nodes: Array<ClusterNode>
    links: Array<ClusterLink>
    clusterGrid: ClusterGrid<ClusterNode>
    electrostaticMagnitude: number
    springiness: number
    springLength: number
    selectedNode: ClusterNode
    highlightedNode: ClusterNode
    private lastMouseLocation: Vector2D
    paused: Boolean = false

    constructor(
        nodes: Array<ClusterNode>,
        links: Array<ClusterLink>,
        topLeft: Vector2D,
        width: number,
        height: number,
        electrostaticMagnitude: number = 0.05,
        springiness: number = 0.01,
        springLength: number = 1.5
    ){
        this.nodes = nodes
        this.links = links
        this.colorNodes()
        this.nodes = this.validateNodes(this.nodes)
        this.clusterGrid = new ClusterGrid<ClusterNode>(topLeft, width, height, 30, 30)
        this.electrostaticMagnitude = electrostaticMagnitude
        this.springiness = springiness
        this.springLength = springLength
    }

    pause(){
        this.paused = true
    }

    play(){
        this.paused = false
    }

    validateNodes(nodes: Array<ClusterNode>): Array<ClusterNode>{
        return nodes//.filter((node: ClusterNode) =>  !!this.links.find((link:ClusterLink) => link.nodeA == node || link.nodeB == node) )
    }

    onMouseDown(location: Vector2D){
        this.selectedNode = this.nodes.find((node: ClusterNode) => {
                let pos = node.transformedPosition()
                let pos2D = new Vector2D(pos.x, pos.y)
                return pos2D.subtract(location).length() < 0.2
            }
        )
    }
    onMouseUp(location: Vector2D){
        this.selectedNode = undefined
    }

    onMouseMove(location: Vector2D){
        this.lastMouseLocation = location
        if(!this.selectedNode){
            this.nodes.forEach((node: ClusterNode) => {
                let pos = node.transformedPosition()
                let pos2D = new Vector2D(pos.x, pos.y)
                if(node.highlight = pos2D.subtract(location).length() < 0.2){
                    this.highlightedNode = node
                }
            })
        }
        else{
            this.selectedNode.velocity = new Vector3D(0,0,0)
            this.selectedNode.transform._translation = new Vector3D(location.x, location.y, this.selectedNode.transform._translation.z)
        }
    }

    colorNodes(){
        let nodeTypes = new Set<string>()
        this.nodes.forEach((node: ClusterNode) => nodeTypes.add(node.info.type))
        let colors = new Map<string, number[]>()
        nodeTypes.forEach((nodeType: string) => {
            colors.set(nodeType, [Math.random(),Math.random(),Math.random(),1] )
        })
        let num = 0
        this.nodes.forEach((node: ClusterNode) => node.setColor(colors.get(node.info.type)))
    }

    static find(nodes: Array<ClusterNode>, uuid: string): ClusterNode | undefined {
        return nodes.find((node: ClusterNode) => node.uuid == uuid)
    }

    static nodeExists(nodes: Array<ClusterNode>, uuid: string): boolean {
        return !!Cluster.find(nodes, uuid)
    }

    update(time: number){
        if(this.selectedNode){
            this.selectedNode.velocity = new Vector3D(0,0,0)
            this.selectedNode.transform._translation = new Vector3D(this.lastMouseLocation.x, this.lastMouseLocation.y, this.selectedNode.transform._translation.z)
        }
        if(!this.paused){
            let positions = this.nodes.map((node: ClusterNode) => [node, node.transformedPosition()])
            positions.forEach(([node, position]: [ClusterNode, Vector3D]) => this.clusterGrid.register(node, position))
            positions.forEach(([nodeA, positionA]: [ClusterNode, Vector3D]) => {
                let force = new Vector3D(0,0,0)
                let others = this.clusterGrid.nodesInCellsWith(nodeA)
                others.forEach((nodeB: ClusterNode) => {
                    let positionB = nodeB.transformedPosition()
                    if(nodeB != nodeA){
                        let diff = positionA.subtract(positionB)
                        let distance = diff.length()
                        let direction = diff.direction(distance)
                        if(distance > 0.1){
                            let magnitude = this.electrostaticMagnitude/distance
                            force = force.translate(direction.scale(magnitude))
                        }
                    }
                })
                nodeA.velocity = nodeA.velocity.translate(force.scale(time))
            })

            this.links.forEach((link: ClusterLink)=> {
                var difference = link.nodeB.transformedPosition().subtract(link.nodeA.transformedPosition());
                var diffLength = difference.length();
                var towardB = difference.direction(diffLength);
                var comparedToDesired = diffLength - this.springLength;
                var force = comparedToDesired * this.springiness;
                var directionalForce = towardB.scale(force);
                var reverseForce = directionalForce.scale(-1);
                link.nodeA.velocity = link.nodeA.velocity.translate(directionalForce);
                link.nodeB.velocity = link.nodeB.velocity.translate(reverseForce);
            })

            this.nodes.forEach((node: ClusterNode) => node.update(time))
        }
    }

    static from(cluster: any, topLeft: Vector2D, width: number, height: number): Cluster{
        let nodes = cluster.nodes.map((node: any) => ClusterNode.from(node)).filter(
            (node: ClusterNode) => true
        )
        let links = cluster.links.filter(
            (link: {uuidA: string, uuidB: string, direction: ClusterLinkDirection}) => {
                if(Cluster.nodeExists(nodes, link.uuidA) && Cluster.nodeExists(nodes, link.uuidB)){
                    return true
                }
                else{
                    //console.warn('No node found for link (' + link.uuidA + ', ' + link.uuidB + '), or is linked to self')
                }
                return false
            }
        ).map((link: {uuidA: string, uuidB: string, direction: ClusterLinkDirection}) => {
            let a = Cluster.find(nodes, link.uuidA)
            let b = Cluster.find(nodes, link.uuidB)
            return new ClusterLink(a, b, link.direction)
        })
        return new Cluster(nodes, links, topLeft, width, height)
    }

}