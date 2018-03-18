import * as React from 'react'
import { Component } from 'react'
import WebGLCanvas from './webgl-canvas'
import { GLScene, GLPolygon, Vector2D, Vector3D, GLObject, Matrix3, GLProgram } from 'simple-gl'
import Cluster from '../cluster/cluster'
import ClusterNode from '../cluster/cluster-node'
import './cluster-gl-style.css'

const vertexShaderSource = require('../shaders/vertex-shader.glsl');
const fragmentShaderSource = require('../shaders/fragment-shader.glsl');

export interface ClusterGLProps{
    cluster: Cluster
}

export default class ClusterGl extends Component<ClusterGLProps,{scale: number, selectedNode: ClusterNode}>{

    programs: Map<string, {vertexShaderSource: string, fragmentShaderSource: string, uniforms:Map<string, any>}>
    screenNodes: Array<{node: ClusterNode, position: Vector2D}> = []
    typeFilters: Set<string> = new Set()
    nameFilters: Set<string> = new Set()

    componentWillMount(){
        this.setState({scale: 0.05})
        let uniforms = new Map<string, any>()
        uniforms.set("projectionMatrix", {mapper:(gl:WebGLRenderingContext, position: WebGLUniformLocation, data: any)=> gl.uniformMatrix4fv(position, false, new Float32Array(data))})
        uniforms.set("cursor_location", {mapper: (gl:WebGLRenderingContext, position: WebGLUniformLocation, data: any)=>gl.uniform2fv(position, new Float32Array(data))})
        let programs = new Map()
        programs.set("main", { 
            vertexShaderSource: vertexShaderSource,
            fragmentShaderSource: fragmentShaderSource, 
            uniforms: uniforms
        });
        this.programs = programs
    }

    viewUpdated(programs: Map<string, GLProgram>, view: Matrix3, width: number, height: number){
        programs.get("main").updateUniform('projectionMatrix', view.matrix4Floats())
        this.screenNodes = this.props.cluster.transformedPositions.map(({node, position}) => {
            return {node: node, position: this.screenPositionFor(position, view, width, height)}
        })
    }

    screenPositionFor(position: Vector3D, view: Matrix3, width: number, height: number): Vector2D{
        let transformed = view.transform(new Vector2D(position.x, position.y))

        return transformed.scaleV(new Vector2D(width/2, -height/2)).translate(new Vector2D(width/2, height/2))
    }

    scenes(): Map<string, GLScene>{
        let scenes = new Map<string, GLScene>()
        let nodes = this.props.cluster.nodes.filter((node) => !node.disabled)
        let links = this.props.cluster.links.filter((link) => !link.disabled)
        scenes.set("cluster", new GLScene([...links, ...nodes]))
        return scenes
    }

    renderConfig(){
        return [
            { scene:"cluster", program: "main", clear: true, clearColor: { r:248/255, g:248/255, b:250/255, a:1 } }
        ]
    }

    update(time: number){
        this.props.cluster.update(time)
        if(this.props.cluster.highlightedNode && this.props.cluster.highlightedNode != this.state.selectedNode){
            this.setState({selectedNode: this.props.cluster.highlightedNode})
        }
        else{
           this.setState({})
        }
    }

    onMouseDown(location: Vector2D){
        this.props.cluster.onMouseDown(location)
    }

    onMouseUp(location: Vector2D){
        this.props.cluster.onMouseUp(location)
    }

    onMouseMove(location: Vector2D){
        this.props.cluster.onMouseMove(location)
    }

    filterChanged(){
        this.props.cluster.links.forEach((link)=>link.disabled = false)
        this.props.cluster.nodes.forEach((node) =>{
            node.disabled = this.typeFilters.has(node.info.type)
            if(node.disabled){
                this.props.cluster.links.forEach((link) => {
                    if(link.nodeA == node || link.nodeB == node){
                        link.disabled = true
                    }
                })
            }
        })
        this.setState({})
    }

    typeFilterClicked(type: string){
        if(this.typeFilters.has(type)){
            this.typeFilters.delete(type)
        }
        else{
            this.typeFilters.add(type)
        }
        this.filterChanged()
    }

    nodeInfo(): JSX.Element {
        let node = this.state.selectedNode
        if(node){
            let otherProperties = Object.keys(node.info.otherProperties).map(
                (key: string) => <div className="row"><div className="col-3">{`${key}:`}</div><div className="col-9">{`${node.info.otherProperties[key]}`}</div></div>
            )
            return <div>
                <h2 style={{textAlign: 'center'}}>{node.info.title}</h2>
                <div className="row" style={{overflowWrap: 'break-word'}}>
                    <div className="col-3">Name:</div><div className="col-9">{node.name}</div>
                    <div className="col-3">Type:</div><div className="col-9">{node.info.type}</div>
                </div>
                <h4 style={{textAlign: 'center', marginTop: '0.5em'}}> Properties </h4>
                {otherProperties}
            </div>
        }
        return <p></p>
    }

    legend(){
        let svgWidth = 300;
        let svgHeight = 30*(this.props.cluster.types.size+1);
        let circles:JSX.Element[] = []
        let names: JSX.Element[] = []
        let currentPos = 0
        this.props.cluster.types.forEach((value, key) => {
            let fill = `rgb(${Math.floor(value.color.r*255)}, ${Math.floor(value.color.g*255)}, ${Math.floor(value.color.b*255)})`
            if(this.typeFilters.has(key)) fill = 'grey'
            circles.push(
                <circle cx={svgWidth-30} cy={currentPos*30 + 30} r={10} fill={fill}/>
            )
            names.push(<li><p onClick={()=>this.typeFilterClicked(key)} className='legendItem' style={{marginBottom:'6px'}}>{key}</p></li>);
            currentPos ++
        })
        return<div>
             <svg style={{position:'absolute', right:'0', bottom:'0', width:(svgWidth + 'px'), height:(svgHeight + 'px')}}>
                {circles}
            </svg>
            <div style={{position:'absolute', right:'0', bottom:'0', width:(svgWidth + 'px'), height:(svgHeight + 'px')}}>
                <ul style={{margin:'0', marginTop: '20px', listStyleType: 'none'}}>
                    {names}
                </ul>
            </div>
        </div>
    }

    text(){
        return this.screenNodes.map(({node, position}) => {
            return <p style={{position: 'absolute', top:(position.y-30), left:(position.x), fontSize:'10px', maxWidth:'15rem', maxHeight:'1.1rem', overflow:'hidden', textOverflow:'ellipsis'}}>{node.info.title}</p>
        })
    }

    render(){
        return <div className="row" style={{margin: "0px"}}>
                <div className="col-9" style={{margin: "0px", padding: "0px", display:'block', height: '100%'}}>
                    <WebGLCanvas
                        programs={this.programs}
                        scenes={this.scenes()}
                        renderConfig={this.renderConfig()}
                        update ={this.update.bind(this)}
                        scale ={this.state.scale}
                        onMouseMove = {this.onMouseMove.bind(this)}
                        onMouseDown = {this.onMouseDown.bind(this)}
                        onMouseUp = {this.onMouseUp.bind(this)}
                        viewUpdated = {this.viewUpdated.bind(this)}
                    />
                    {this.legend()}
                    <div style={{width:'100%', height:'100%', position:'absolute', top:'0', left:'0', bottom:'0', right:'0', pointerEvents:'none', overflow:'hidden'}}>
                        {this.text()}
                    </div>
                </div>
                <div className="col-3">
                   { this.nodeInfo() }
                </div>
        </div>
    }
}