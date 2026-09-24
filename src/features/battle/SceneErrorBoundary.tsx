'use client';
import React from 'react';
type Props=React.PropsWithChildren<{onReset?:()=>void}>;type State={failed:boolean};
export default class SceneErrorBoundary extends React.Component<Props,State>{
  state:State={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error){console.error('ShellForge 3D scene failed; keeping tactical UI available',error);}
  render(){return this.state.failed?<div role="status" style={{position:'absolute',inset:'30% 12% auto',zIndex:1,padding:16,textAlign:'center',color:'#f0cf91',background:'#081b1be8',border:'1px solid #9e8150'}}>3D 舞台暂不可用，仍可继续操作。{this.props.onReset&&<div><button onClick={this.props.onReset}>重置本场战斗</button></div>}</div>:this.props.children;}
}
