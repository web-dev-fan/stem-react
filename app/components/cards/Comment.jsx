import React from 'react';
import {Link, browserHistory} from 'react-router';
import Author from 'app/components/elements/Author';
import ReplyEditor from 'app/components/elements/ReplyEditor';
import MarkdownViewer from 'app/components/cards/MarkdownViewer';
import shouldComponentUpdate from 'app/utils/shouldComponentUpdate'
// import FormattedAsset from 'app/components/elements/FormattedAsset';
import Voting from 'app/components/elements/Voting';
import { connect } from 'react-redux';
import user from 'app/redux/User';
import TimeAgoWrapper from 'app/components/elements/TimeAgoWrapper';
// import Tooltip from 'app/components/elements/Tooltip';
import Icon from 'app/components/elements/Icon';
import Userpic from 'app/components/elements/Userpic';
import transaction from 'app/redux/Transaction'
import {List, Set} from 'immutable'
import {Long} from 'bytebuffer'
import pluralize from 'pluralize';
import {parsePayoutAmount, repLog10} from 'app/utils/ParsersAndFormatters';

export function sortComments( g, comments, sort_order ){

  function netNegative(a)  {
      return a.get("net_rshares") < 0;
  }

  let sort_orders = {
  /** sort replies by active */
      active: (a,b) => {
                let acontent = g.get('content').get(a);
                let bcontent = g.get('content').get(b);
                if (netNegative(acontent)) {
                    return 1;
                } else if (netNegative(bcontent)) {
                    return -1;
                }
                let aactive = Date.parse( acontent.get('active') );
                let bactive = Date.parse( bcontent.get('active') );
                return bactive - aactive;
              },
      update: (a,b) => {
                let acontent = g.get('content').get(a);
                let bcontent = g.get('content').get(b);
                if (netNegative(acontent)) {
                    return 1;
                } else if (netNegative(bcontent)) {
                    return -1;
                }
                let aactive = Date.parse( acontent.get('last_update') );
                let bactive = Date.parse( bcontent.get('last_update') );
                return bactive.getTime() - aactive.getTime();
              },
      created:  (a,b) =>  {
                let acontent = g.get('content').get(a);
                let bcontent = g.get('content').get(b);
                if (netNegative(acontent)) {
                    return 1;
                } else if (netNegative(bcontent)) {
                    return -1;
                }
                let aactive = Date.parse( acontent.get('created') );
                let bactive = Date.parse( bcontent.get('created') );
                return bactive - aactive;
              },
      trending:  (a,b) => {
                let acontent = g.get('content').get(a);
                let bcontent = g.get('content').get(b);
                if (netNegative(acontent)) {
                    return 1;
                } else if (netNegative(bcontent)) {
                    return -1;
                }
                let aactive = acontent.get('children_rshares2');
                let bactive = bcontent.get('children_rshares2');
                aactive = ("0").repeat( 100 - aactive.length ) + aactive;
                bactive = ("0").repeat( 100 - bactive.length ) + bactive;
                if( bactive < aactive ) return -1;
                if( bactive > aactive ) return 1;
                return 0;
              }
  }
  comments.sort( sort_orders[sort_order] );
};

class CommentImpl extends React.Component {

    static propTypes = {
        // html props
        global: React.PropTypes.object.isRequired,
        content: React.PropTypes.string.isRequired,
        sort_order: React.PropTypes.oneOf(['active', 'update', 'created', 'trending']).isRequired,
        root: React.PropTypes.bool,
        showNegativeComments: React.PropTypes.bool,
        authorRepLog10: React.PropTypes.number,
        onHide: React.PropTypes.func,

        // component props (for recursion)
        depth: React.PropTypes.number,

        // redux props
        username: React.PropTypes.string,
        rootComment: React.PropTypes.string.isRequired,
        comment_link: React.PropTypes.string.isRequired,
        anchor_link: React.PropTypes.string.isRequired,
        netVoteSign: React.PropTypes.number.isRequired,
        deletePost: React.PropTypes.func.isRequired,
    };
    static defaultProps = {
        depth: 1,
    }

    constructor(props) {
        super();
        const {netVoteSign, hasPendingPayout} = props
        this.state = {show_details: true, hide_body: !hasPendingPayout && netVoteSign < 0};
        this.revealBody = this.revealBody.bind(this);
        this.shouldComponentUpdate = shouldComponentUpdate(this, 'Comment')
        this.onCommentClick = e => {
            e.preventDefault()
            const {comment_link} = this.props
            browserHistory.push(comment_link)
        }
        this.onShowReply = () => {
            const {showReply} = this.state
            this.setState({showReply: !showReply, showEdit: false})
            this.saveOnShow(!showReply ? 'reply' : null)
        }
        this.onShowEdit = () => {
            const {showEdit} = this.state
            this.setState({showEdit: !showEdit, showReply: false})
            this.saveOnShow(!showEdit ? 'edit' : null)
        }
        this.saveOnShow = (type) => {
            if(process.env.BROWSER) {
                const g = this.props.global;
                const content = g.get('content').get(this.props.content)
                const formId = content.get('author') + '/' + content.get('permlink')
                if(type)
                    localStorage.setItem('showEditor-' + formId, JSON.stringify({type}, null, 0))
                else {
                    localStorage.removeItem('showEditor-' + formId)
                    localStorage.removeItem('replyEditorData-' + formId + '-reply')
                    localStorage.removeItem('replyEditorData-' + formId + '-edit')
                }
            }
        }
        this.saveOnShow = this.saveOnShow.bind(this)
        this.onDeletePost = () => {
            const {props: {deletePost}} = this
            const content = this.props.global.get('content').get(this.props.content);
            deletePost(content.get('author'), content.get('permlink'))
        }
        this.toggleDetails = this.toggleDetails.bind(this);
    }
    componentWillMount() {
        this.initEditor(this.props)
        const g = this.props.global;
        const content = g.get('content').get(this.props.content);
        if (content) {
            const {showNegativeComments, hasPendingPayout, authorRepLog10, onHide} = this.props
            const {hide_body} = this.state
            const auto_hide = !showNegativeComments && authorRepLog10 < 0 && content.get('replies').size === 0 && !hasPendingPayout
            if(!showNegativeComments && (auto_hide || hide_body)) {
                // console.log('Comment --> onHide')
                if(onHide) onHide()
            }
            this.setState({auto_hide})
        }
    }
    componentDidMount() {
        const {anchor_link} = this.props
        if (window.location.hash.indexOf(anchor_link) !== -1) {
            const comments_el = document.getElementById(anchor_link);
            if (comments_el) comments_el.scrollIntoView({behavior: 'smooth'});
        }
    }
    toggleDetails() {
        this.setState({show_details: !this.state.show_details});
    }
    revealBody() {
        this.setState({hide_body: false});
    }
    initEditor(props) {
        if(this.state.PostReplyEditor) return
        const g = props.global;
        const content = g.get('content').get(props.content);
        if (!content) return
        const post = content.get('author') + '/' + content.get('permlink')
        const PostReplyEditor = ReplyEditor(post + '-reply')
        const PostEditEditor = ReplyEditor(post + '-edit')
        if(process.env.BROWSER) {
            const formId = post
            let showEditor = localStorage.getItem('showEditor-' + formId)
            if(showEditor) {
                showEditor = JSON.parse(showEditor)
                if(showEditor.type === 'reply') {
                    this.setState({showReply: true})
                }
                if(showEditor.type === 'edit') {
                    this.setState({showEdit: true})
                }
            }
        }
        this.setState({PostReplyEditor, PostEditEditor})
    }
    render() {
        let g = this.props.global;
        const dis = g.get('content').get(this.props.content);
        if (!dis) {
            return <div>Loading...</div>
        }
        const comment = dis.toJS();
        const {author, permlink, json_metadata} = comment
        const {username, depth, rootComment, comment_link, anchor_link, netVoteSign, showNegativeComments,
            authorRepLog10, ignore, onHide} = this.props
        const {onCommentClick, onShowReply, onShowEdit, onDeletePost} = this
        const post = comment.author + '/' + comment.permlink
        const {PostReplyEditor, PostEditEditor, showReply, showEdit, hide_body, auto_hide} = this.state
        const Editor = showReply ? PostReplyEditor : PostEditEditor

        const negative_comment = ignore || authorRepLog10 < 1 // rephide
        if(!showNegativeComments && (auto_hide || hide_body)) {
            if(onHide) onHide()
            return <span></span>
        }

        let jsonMetadata = null
        try {
            if(!showReply) jsonMetadata = JSON.parse(json_metadata)
        } catch(error) {
            // console.error('Invalid json metadata string', json_metadata, 'in post', this.props.content);
        }
        // const get_asset_value = ( asset_str ) => { return parseFloat( asset_str.split(' ')[0] ); }
        // const steem_supply = this.props.global.getIn(['props','current_supply']);

        const showDeleteOption = username === author &&
            dis.get('replies', List()).size === 0 &&
            netVoteSign <= 0

        // let robohash = "https://robohash.org/" + author + ".png?size=64x64"
        const total_payout = parsePayoutAmount(comment.total_payout_value);
        const showEditOption = username === author && total_payout === 0

        let replies = null;
        let body = null;
        let controls = null;

        if (this.state.show_details && (!hide_body || showNegativeComments)) {
            body = (<MarkdownViewer formId={post + '-viewer'} text={comment.body} jsonMetadata={jsonMetadata} />);
            controls = (<div>
                <Voting post={post} pending_payout={comment.pending_payout_value} total_payout={comment.total_payout_value} />
                {!$STM_Config.read_only_mode && depth !== 5 && <a onClick={onShowReply}>Reply</a>}
                {showEditOption && <span>
                    &nbsp;&nbsp;
                    <a onClick={onShowEdit}>Edit</a>
                </span>}
                {showDeleteOption && <span>
                    &nbsp;&nbsp;
                    <a onClick={onDeletePost}>Delete</a>
                </span>}
            </div>);
        }

        if(this.state.show_details) {
            replies = comment.replies;
            sortComments( g, replies, this.props.sort_order );
            replies = replies.map((reply, idx) => <Comment key={idx} content={reply} global={g}
                sort_order={this.props.sort_order} depth={depth + 1} rootComment={rootComment} showNegativeComments={showNegativeComments} />);
        }

        const commentClasses = ['hentry']
        commentClasses.push('Comment')
        commentClasses.push(this.props.root ? 'root' : 'reply')
        if((hide_body && !showNegativeComments) || !this.state.show_details) commentClasses.push('collapsed');
        const downVotedClass = netVoteSign < 0 || (negative_comment || hide_body) ? 'downvoted' : ' '
        //console.log(comment);
        let renderedEditor = null;
        if (showReply || showEdit) {
            renderedEditor = <div key="editor">
                <Editor {...comment} type={showReply ? 'submit_comment' : 'edit'}
                                     successCallback={() => {
                                this.setState({showReply: false, showEdit: false})
                                this.saveOnShow(null)
                            }}
                                     onCancel={() => {
                                this.setState({showReply: false, showEdit: false})
                                this.saveOnShow(null)
                            }}
                                     jsonMetadata={jsonMetadata}
                />
            </div>
        }
        return (
            <div className={commentClasses.join(' ')} id={anchor_link} itemScope itemType ="http://schema.org/comment">
                {/*<a name={anchor_link}></a>*/}
                <div className="Comment__Userpic show-for-medium">
                    <Userpic account={comment.author} />
                </div>
                <div className={downVotedClass}>
                    <div className="Comment__header">
                        <div className="Comment__header_collapse">
                            <Voting post={post} flag />
                            <a title="Collapse/Expand" onClick={this.toggleDetails}>{ this.state.show_details ? '[-]' : '[+]' }</a>
                        </div>
                        <span className="Comment__header-user">
                            <Icon name="user" className="Comment__Userpic-small" />
                            <span itemProp="author" itemScope itemType="http://schema.org/Person">
                                <Author author={comment.author} authorRepLog10={authorRepLog10} /></span>
                        </span>
                        &nbsp; &middot; &nbsp;
                        <a href={comment_link} onClick={onCommentClick} className="PlainLink">
                            <TimeAgoWrapper date={comment.created} id={`@${author}/${permlink}`} />
                        </a>
                        { !this.state.show_details && (hide_body && !showNegativeComments) &&
                          <Voting post={post} pending_payout={comment.pending_payout_value} total_payout={comment.total_payout_value} showList={comment.active_votes.length !== 0 ? true : false} /> }
                        { this.state.show_details || comment.children == 0 ||
                          <span className="marginLeft1rem">{pluralize('replies', comment.children, true)}</span>}
                        { this.state.show_details && (hide_body && !showNegativeComments) &&
                            <a className="marginLeft1rem" onClick={this.revealBody}>reveal comment</a>}
                    </div>
                    <div className="Comment__body entry-content">
                        {showEdit ? renderedEditor : body}
                    </div>
                    <div className="Comment__footer">
                        {controls}
                    </div>
                </div>
                <div className="Comment__replies hfeed">
                    {showReply && renderedEditor}
                    {replies}
                </div>
            </div>
        );
    }
}

const Comment = connect(
    // mapStateToProps
    (state, ownProps) => {
        const {global, content} = ownProps
        let {depth} = ownProps
        if(depth == null) depth = 1
        const c = global.getIn(['content', content])
        let comment_link = null, anchor_link = null
        let rc = ownProps.rootComment
        if(c) {
            if(depth === 1) rc = c.get('parent_author') + '/' + c.get('parent_permlink')
            comment_link = `/${c.get('category')}/@${rc}#@${c.get('author')}/${c.get('permlink')}`
            anchor_link = `#@${c.get('author')}/${c.get('permlink')}`
        }
        const comment = global.get('content').get(ownProps.content);
        let votes = Long.ZERO
        let hasPendingPayout
        if (comment) {
            comment.get('active_votes').forEach(v => {
                // console.log('voter', v.get('voter'), v.get('rshares'), v.toJS())
                votes = votes.add(Long.fromString('' + v.get('rshares')))
            })
            const pending_payout = comment.get('pending_payout_value');
            // const total_payout = comment.get('total_payout_value');
            hasPendingPayout = parsePayoutAmount(pending_payout) >= 0.02
        }
        const netVoteSign = votes.compare(Long.ZERO)
        const current = state.user.get('current')
        const username = current ? current.get('username') : null
        const ignore = username ? state.global.getIn(['follow', 'get_following', username, 'result', c.get('author')], List()).contains('ignore') : false
        const authorRepLog10 = repLog10(c.get('author_reputation'))
        return {
            ...ownProps,
            netVoteSign,
            comment_link,
            anchor_link,
            rootComment: rc,
            username: state.user.getIn(['current', 'username']),
            ignore,
            hasPendingPayout,
            authorRepLog10,
        }
    },

    // mapDispatchToProps
    (dispatch) => ({
        unlock: () => { dispatch(user.actions.showLogin()) },
        deletePost: (author, permlink) => {
            dispatch(transaction.actions.broadcastOperation({
                type: 'delete_comment',
                operation: {author, permlink},
                confirm: 'Are you sure?'
            }))
        },
    })
)(CommentImpl)
export default Comment;
