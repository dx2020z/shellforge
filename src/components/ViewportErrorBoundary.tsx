'use client';
import React from 'react';

type Props={children:React.ReactNode;onReset:()=>void};
type State={error:Error|null};
export default class ViewportErrorBoundary extends React.Component<Props,State>{
  state:State={error:null};
  static getDerivedStateFromError(error:Error):State{return {error};}
  componentDidCatch(error:Error){console.error('ShellForge viewport failed to render',error);}
  render(){
    if(!this.state.error)return this.props.children;
    return <div role="alert" style={{position:'absolute',inset:0,zIndex:10,display:'grid',placeContent:'center',gap:14,padding:24,textAlign:'center',color:'#f1dfb4',background:'#081b1b'}}>
      <strong>视窗渲染失败</strong><span>{this.state.error.message||'未知渲染错误'}</span><button onClick={()=>{this.props.onReset();this.setState({error:null});}}>重置本场战斗</button>
    </div>;
  }
}
